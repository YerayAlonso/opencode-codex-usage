import { spawn } from "node:child_process"

// One short-lived stdio connection per request; never reads or copies credentials.
export function codexRequest(method: string, params?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", ["app-server"], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] })
    let buffer = ""
    let done = false
    const finish = (error?: string, result?: unknown) => {
      if (done) return
      done = true
      clearTimeout(timer)
      child.stdin.destroy()
      child.kill()
      if (error) reject(new Error(error))
      else resolve(result)
    }
    const timer = setTimeout(() => finish("error.timeout"), 20000)
    child.on("error", () => finish("error.cliMissing"))
    child.on("close", () => finish("error.closed"))
    child.stdin.on("error", () => finish("error.communication"))
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk
      if (buffer.length > 1024 * 1024) return finish("error.responseTooLarge")
      let newline: number
      while (!done && (newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        let message: any
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        if (message.id === 1) {
          if (message.error) return finish("error.serverStart")
          child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n")
          child.stdin.write(JSON.stringify({ id: 2, method, ...(params === undefined ? {} : { params }) }) + "\n")
        } else if (message.id === 2) {
          finish(
            message.error ? (method === "account/rateLimits/read" ? "error.auth" : "error.reset") : undefined,
            message.result,
          )
        }
      }
    })
    child.stdin.write(
      JSON.stringify({
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "codex-usage-desktop", version: "0.2.0" } },
      }) + "\n",
    )
  })
}

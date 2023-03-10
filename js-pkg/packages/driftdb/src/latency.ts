export class LatencyTest {
  private startTime: number
  private endTime: number | null = null
  private signal: Promise<void>
  private resolve!: () => void

  constructor() {
    this.startTime = performance.now()
    this.signal = new Promise((resolve) => {
      this.resolve = resolve
    })
  }

  receivedResponse() {
    this.endTime = performance.now()
    this.resolve()
  }

  async result() {
    await this.signal
    return this.endTime! - this.startTime
  }
}

/** No frequency cap: one frame in flight, then the latest pending work. Idle costs zero frames. */
export class FrameQueue {
  private frame = 0;
  private running = false;
  private pending = false;
  private readContent = false;
  private visible = true;
  private readonly controller = new AbortController();
  constructor(
    private readonly render: (
      content: boolean,
      signal: AbortSignal,
    ) => Promise<void>,
    private readonly failure: (error: unknown) => void,
  ) {}

  request(content = false): void {
    if (this.controller.signal.aborted) return;
    this.pending = true;
    this.readContent ||= content;
    if (!this.frame && !this.running && this.visible)
      this.frame = requestAnimationFrame(this.flush);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible && this.pending) this.request();
    if (!visible) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  dispose(): void {
    this.controller.abort();
    cancelAnimationFrame(this.frame);
  }

  private flush = async (): Promise<void> => {
    this.frame = 0;
    this.pending = false;
    this.running = true;
    const content = this.readContent;
    this.readContent = false;
    try {
      await this.render(content, this.controller.signal);
    } catch (error) {
      if (!this.controller.signal.aborted) this.failure(error);
    } finally {
      this.running = false;
      if (this.pending) this.request();
    }
  };
}

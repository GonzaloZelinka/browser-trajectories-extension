import puppeteer, { Browser, ExtensionTransport } from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser';

export class ConnectionManager {
  private connections: Map<number, Browser> = new Map();

  async getConnection(tabId: number): Promise<Browser> {
    if (this.connections.has(tabId)) {
      return this.connections.get(tabId)!;
    }

    const extensionTransport = await ExtensionTransport.connectTab(tabId);
    const browser = await puppeteer.connect({
      transport: extensionTransport,
      defaultViewport: null,
    });

    this.connections.set(tabId, browser);
    return browser;
  }

  async closeConnection(tabId: number): Promise<void> {
    const browser = this.connections.get(tabId);
    if (browser) {
      await browser.disconnect();
      this.connections.delete(tabId);
    }
  }
}
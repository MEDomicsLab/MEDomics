/* eslint-disable */
export {}

declare global {
  interface Window {
    backend: {
      requestExpress: (req: any) => Promise<any>
      request: (req: any) => Promise<any>
      getExpressPort: () => Promise<number>
    }
  }
}

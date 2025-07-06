export const PORT_FINDING_METHOD = {
  FIX: 0,
  AVAILABLE: 1
}

const config = {
  runServerAutomatically: true,
  useReactDevTools: false,
  mongoPort: 54017,
  defaultPort: 3000,
  portFindingMethod: PORT_FINDING_METHOD.FIX
}

export default config

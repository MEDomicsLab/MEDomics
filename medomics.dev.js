export const PORT_FINDING_METHOD = {
  FIX: 0,
  AVAILABLE: 1
}

const config = {
  runServerAutomatically: true,
  useReactDevTools: false,
  defaultPort: 3000,
  mongoPort: 54017,
  portFindingMethod: PORT_FINDING_METHOD.FIX
}

export default config

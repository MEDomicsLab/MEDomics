/**
 * Builds a Jupyter notebook (as a JSON string) for configuring and running a MEDfl FlowerClient,
 * supporting both XGBoost and Neural Network modes. The notebook includes code cells for imports,
 * configuration, data checks, client instantiation, and execution.
 *
 * @param {Object} cfg - The configuration object for the notebook.
 * @param {string} cfg.server_address - The address of the Flower server.
 * @param {string} cfg.data_path - The path to the local dataset.
 * @param {string} cfg.model_type - The type of model ("xgb" for XGBoost, otherwise Neural Network).
 * @param {Object} [cfg.xgb_params] - (Optional) Parameters for XGBoost, if model_type is "xgb".
 * @param {number} [cfg.xgb_rounds] - (Optional) Number of boosting rounds for XGBoost.
 * @param {Object} [cfg.dp] - (Optional) Differential privacy configuration for Neural Network mode.
 * @param {number} [cfg.dp.noise_multiplier] - Noise multiplier for DP.
 * @param {number} [cfg.dp.max_grad_norm] - Maximum gradient norm for DP.
 * @param {number} [cfg.dp.batch_size] - Batch size for DP.
 * @returns {string} The notebook as a JSON string, ready to be saved or executed.
 */

function toPythonLiteral(value) {
  if (value === null || value === undefined) return "None";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}: ${toPythonLiteral(v)}`)
      .join(", ")}}`;
  }
  return "None";
}


export function buildNotebookText(cfg) {
  const isXGB = cfg.model_type === "xgb";

  const mdTitle =
    `# MEDfl Flower Client — ${isXGB ? "XGBoost" : "Neural Network"} Configuration\n` +
    `This notebook instantiates a **FlowerClient** from \`MEDfl.rw.client\` to run in **${isXGB ? "XGBoost" : "NN"}** mode.\n\n` +
    `**Notes:**\n` +
    (isXGB
      ? "- \`dp_config=None\` (DP applies to NN only in this setup).\n- Set/adjust \`xgb_params\` and \`xgb_rounds\`.\n"
      : "- Provide a \`DPConfig\` if you want DP; otherwise set \`dp_config=None\`.\n");

  const cellImports =
    `# --- 1) Imports\n` +
    `from MEDfl.rw.client import FlowerClient, DPConfig\n` +
    `import os\n` +
    (isXGB ? `\ntry:\n    import xgboost as xgb\nexcept Exception as e:\n    print("[WARN] xgboost not importable:", e)\n` : ``);

  const cellBaseCfg =
    `# --- 2) Base configuration\nserver_address = ${toPythonLiteral(cfg.server_address)}\n` +
    `data_path = ${toPythonLiteral(cfg.data_path)}\n`;

  let cellModeCfg = "";
  if (isXGB) {
    const rounds = cfg.xgb_rounds ?? 10;
    const params = cfg.xgb_params ?? {
      max_depth: 4,
      eta: 0.2,
      objective: "binary:logistic",
      subsample: 0.9,
      colsample_bytree: 0.9,
      eval_metric: "auc",
    };
    cellModeCfg =
      `\n# --- 3) XGBoost-specific settings\nxgb_params = ${toPythonLiteral(params)}\n` +
      `xgb_rounds = ${toPythonLiteral(rounds)}\n` +
      `\ndp_config = None\n`;
  } else {
    const dp = cfg.dp ?? null;
    const dpLine = dp
      ? `DPConfig(noise_multiplier=${toPythonLiteral(dp.noise_multiplier)}, max_grad_norm=${toPythonLiteral(dp.max_grad_norm)}, batch_size=${toPythonLiteral(dp.batch_size)})`
      : `None`;
    cellModeCfg =
      `\n# --- 3) NN-specific settings\n` +
      `dp_config = ${dpLine}\n`;
  }

  const cellDataCheck =
    `# --- 4) Data existence check\n` +
    `if not os.path.exists(data_path):\n` +
    `    print(f"[WARN] Data path does not exist: {data_path}")\n` +
    `else:\n` +
    `    print(f"[OK] Found data at: {data_path}")\n`;

  const cellClientInit =
    `# --- 5) Instantiate FlowerClient\nclient = FlowerClient(\n` +
    `    server_address=server_address,\n` +
    `    data_path=data_path,\n` +
    `    dp_config=dp_config,\n` +
    `    model_type=${toPythonLiteral(cfg.model_type)},\n` +
    (isXGB
      ? `    xgb_params=xgb_params,\n    xgb_rounds=xgb_rounds\n`
      : ``) +
    `)\nprint("Client initialized (${cfg.model_type} mode).")\n`;

  const cellStart =
    `# --- 6) Start FL client\n` +
    `client.start()\n`;

  const nb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
      language_info: { name: "python", version: "3.x" },
    },
    cells: [
      { cell_type: "markdown", metadata: {}, source: mdTitle.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellImports.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: (cellBaseCfg + cellModeCfg).split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellDataCheck.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellClientInit.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellStart.split("\n").map((s) => s + "\n") },
    ],
  };

  return JSON.stringify(nb, null, 2);
}


// serverNotebookBuilder.js

/**
 * Build a Jupyter .ipynb (JSON text) that configures and starts a MEDfl FederatedServer.
 *
 * @param {Object} cfg
 * @param {string} cfg.host
 * @param {number} cfg.port
 * @param {number} cfg.num_rounds         // server num_rounds
 * @param {Object} cfg.strategy           // Strategy() kwargs
 * @param {string} cfg.strategy.name
 * @param {number} cfg.strategy.fraction_fit
 * @param {number} cfg.strategy.min_fit_clients
 * @param {number} cfg.strategy.min_evaluate_clients
 * @param {number} cfg.strategy.min_available_clients
 * @param {number} cfg.strategy.local_epochs
 * @param {number} cfg.strategy.threshold
 * @param {number} cfg.strategy.learning_rate
 * @param {string} cfg.strategy.optimizer_name
 * @param {number} cfg.strategy.saveOnRounds
 * @param {string} cfg.strategy.savingPath
 * @param {number} cfg.strategy.total_rounds
 */
export function buildServerNotebookText(cfg) {
  // Safe defaults (you can override via cfg)
  const host = cfg.host ?? "0.0.0.0";
  const port = cfg.port ?? 8080;
  const num_rounds = cfg.num_rounds ?? 10;

  const strategy = {
    name: "XGBoostBagging",
    fraction_fit: 1,
    min_fit_clients: 1,
    min_evaluate_clients: 1,
    min_available_clients: 1,
    local_epochs: 1,
    threshold: 0.5,
    learning_rate: 0.01,
    optimizer_name: "SGD",
    saveOnRounds: 3,
    savingPath: "./",
    total_rounds: 10,
    ...(cfg.strategy || {}),
  };

  const mdTitle =
    `# MEDfl Federated Server — Strategy & Launch\n` +
    `This notebook builds a **Strategy** and starts a **FederatedServer** from \`MEDfl.rw.server\`.\n\n` +
    `Edit the parameters below as needed before running.\n`;

  const cellImports =
    `# --- 1) Imports\n` +
    `from MEDfl.rw.server import FederatedServer, Strategy\n`;

  const cellConfig =
    `# --- 2) Server & Strategy configuration\n` +
    `host = ${toPythonLiteral(host)}\n` +
    `port = ${toPythonLiteral(port)}\n` +
    `num_rounds = ${toPythonLiteral(num_rounds)}\n\n` +
    `strategy_kwargs = {\n` +
    `    "name": ${toPythonLiteral(strategy.name)},\n` +
    `    "fraction_fit": ${toPythonLiteral(strategy.fraction_fit)},\n` +
    `    "min_fit_clients": ${toPythonLiteral(strategy.min_fit_clients)},\n` +
    `    "min_evaluate_clients": ${toPythonLiteral(strategy.min_evaluate_clients)},\n` +
    `    "min_available_clients": ${toPythonLiteral(strategy.min_available_clients)},\n` +
    `    "local_epochs": ${toPythonLiteral(strategy.local_epochs)},\n` +
    `    "threshold": ${toPythonLiteral(strategy.threshold)},\n` +
    `    "learning_rate": ${toPythonLiteral(strategy.learning_rate)},\n` +
    `    "optimizer_name": ${toPythonLiteral(strategy.optimizer_name)},\n` +
    `    "saveOnRounds": ${toPythonLiteral(strategy.saveOnRounds)},\n` +
    `    "savingPath": ${toPythonLiteral(strategy.savingPath)},\n` +
    `    "total_rounds": ${toPythonLiteral(strategy.total_rounds)},\n` +
    `}\n`;

  const cellStrategy =
    `# --- 3) Create Strategy\n` +
    `custom_strategy = Strategy(**strategy_kwargs)\n` +
    `print("Strategy created:", custom_strategy)\n`;

  const cellServer =
    `# --- 4) Create FederatedServer\n` +
    `server = FederatedServer(\n` +
    `    host=host,\n` +
    `    port=port,\n` +
    `    num_rounds=num_rounds,\n` +
    `    strategy=custom_strategy,\n` +
    `)\n` +
    `print(f"Server ready at {host}:{port} for {num_rounds} rounds.")\n`;

  const cellStart =
    `# --- 5) Start server (blocking)\n` +
    `server.start()\n`;

  const nb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
      language_info: { name: "python", version: "3.x" },
    },
    cells: [
      { cell_type: "markdown", metadata: {}, source: mdTitle.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellImports.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellConfig.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellStrategy.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellServer.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellStart.split("\n").map((s) => s + "\n") },
    ],
  };

  return JSON.stringify(nb, null, 2);
}

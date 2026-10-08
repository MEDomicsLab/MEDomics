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

/**
 * Builds the "SHAP configuration" code cell shared by the NN and XGBoost server
 * notebooks, mirroring the SHAPConfig construction in runServer.py / run_xgb_rw_server.py.
 * The `explainer` is intentionally not read from `shapCfg` — the real backend scripts
 * hardcode it per model type ("gradient" for NN, "tree" for XGBoost), so `defaultExplainer`
 * is always used, matching that behavior exactly.
 *
 * @param {Object|null} shapCfg - The raw flShapNode settings object, or null/undefined if disabled.
 * @param {string} defaultExplainer - "gradient" (NN) or "tree" (XGBoost).
 * @param {number} cellNumber - Cell number for the comment header.
 */
function buildShapCell(shapCfg, defaultExplainer, cellNumber) {
  if (!shapCfg) {
    return (
      `# --- ${cellNumber}) SHAP configuration (disabled)\n` +
      `shap_config = None\n`
    );
  }
  return (
    `# --- ${cellNumber}) SHAP configuration\n` +
    `shap_config = SHAPConfig(\n` +
    `    enabled=True,\n` +
    `    explainer=${toPythonLiteral(defaultExplainer)},\n` +
    `    data_split=${toPythonLiteral(shapCfg.dataSplit ?? "validation")},\n` +
    `    background_size=${toPythonLiteral(shapCfg.backgroundSize ?? 100)},\n` +
    `    explanation_size=${toPythonLiteral(shapCfg.explanationSize ?? 50)},\n` +
    `    random_seed=${toPythonLiteral(shapCfg.random_seed ?? 42)},\n` +
    `    minimum_samples=${toPythonLiteral(shapCfg.minimumSamples ?? 10)},\n` +
    `    clipping_value=None,\n` +
    `    include_client_results=${toPythonLiteral(shapCfg.includeClientResults ?? true)},\n` +
    `)\n`
  );
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
 * @param {string} [cfg.strategy.features] - Comma-separated feature columns.
 * @param {string} [cfg.strategy.target] - Target column name.
 * @param {number} [cfg.strategy.val_fraction]
 * @param {number} [cfg.strategy.test_fraction]
 * @param {string} [cfg.strategy.split_mode] - "global" or "per_client".
 * @param {string} [cfg.strategy.id_col]
 * @param {Object} [cfg.strategy.client_fractions]
 * @param {boolean} [cfg.use_transfer_learning] - Whether to load pretrained weights.
 * @param {string} [cfg.pretrained_model_path] - Path to the pretrained model (required if use_transfer_learning).
 * @param {Object|null} [cfg.shap] - The raw flShapNode settings, or null/undefined if SHAP is disabled.
 */
export function buildServerNotebookText(cfg) {
  // Safe defaults (you can override via cfg)
  const host = cfg.host ?? "0.0.0.0";
  const port = cfg.port ?? 8080;
  const num_rounds = cfg.num_rounds ?? 10;

  const strategy = {
    name: "FedAvg",
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
    features: "",
    target: "",
    val_fraction: 0.10,
    test_fraction: 0.10,
    split_mode: "global",
    id_col: "id",
    client_fractions: {},
    ...(cfg.strategy || {}),
  };

  const useTransferLearning = !!cfg.use_transfer_learning;
  const pretrainedModelPath = cfg.pretrained_model_path ?? "";
  const shap = cfg.shap ?? null;

  const mdTitle =
    `# MEDfl Federated Server — Strategy & Launch\n` +
    `This notebook builds a **Strategy** and starts a **FederatedServer** from \`MEDfl.rw.server\`.\n\n` +
    `Edit the parameters below as needed before running.\n`;

  const cellImports =
    `# --- 1) Imports\n` +
    `from MEDfl.rw.server import FederatedServer, Strategy\n` +
    `from MEDfl.LearningManager.model import Model\n` +
    `from MEDfl.rw.model import Net\n` +
    `from MEDfl.LearningManager.shap import SHAPConfig\n`;

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
    `    "features": ${toPythonLiteral(strategy.features)},\n` +
    `    "target": ${toPythonLiteral(strategy.target)},\n` +
    `    "val_fraction": ${toPythonLiteral(strategy.val_fraction)},\n` +
    `    "test_fraction": ${toPythonLiteral(strategy.test_fraction)},\n` +
    `    "split_mode": ${toPythonLiteral(strategy.split_mode)},\n` +
    `    "id_col": ${toPythonLiteral(strategy.id_col)},\n` +
    `    "client_fractions": ${toPythonLiteral(strategy.client_fractions)},\n` +
    `}\n`;

  const cellTransfer =
    `# --- 3) Optional transfer learning: load pretrained weights\n` +
    `use_transfer_learning = ${toPythonLiteral(useTransferLearning)}\n` +
    `pretrained_model_path = ${toPythonLiteral(pretrainedModelPath)}\n\n` +
    `initial_parameters = None\n` +
    `if use_transfer_learning:\n` +
    `    if not pretrained_model_path:\n` +
    `        raise ValueError("use_transfer_learning is true but no pretrained_model_path provided.")\n` +
    `    loaded_model = Model.load_model(pretrained_model_path)\n` +
    `    feature_list = [f.strip() for f in strategy_kwargs["features"].split(",") if f.strip()]\n` +
    `    num_features = len(feature_list)\n` +
    `    model = Net(num_features)\n` +
    `    model.load_state_dict(loaded_model)\n` +
    `    model.eval()\n` +
    `    initial_parameters = [val.cpu().numpy() for val in model.state_dict().values()]\n\n` +
    `strategy_kwargs["initial_parameters"] = initial_parameters\n`;

  const cellShap = buildShapCell(shap, "gradient", 4);

  const cellStrategy =
    `# --- 5) Create Strategy\n` +
    `custom_strategy = Strategy(**strategy_kwargs)\n` +
    `print("Strategy created:", custom_strategy)\n`;

  const cellServer =
    `# --- 6) Create FederatedServer\n` +
    `server = FederatedServer(\n` +
    `    host=host,\n` +
    `    port=port,\n` +
    `    num_rounds=num_rounds,\n` +
    `    strategy=custom_strategy,\n` +
    `    shap_config=shap_config,\n` +
    `)\n` +
    `print(f"Server ready at {host}:{port} for {num_rounds} rounds.")\n`;

  const cellStart =
    `# --- 7) Start server (blocking)\n` +
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
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellTransfer.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellShap.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellStrategy.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellServer.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellStart.split("\n").map((s) => s + "\n") },
    ],
  };

  return JSON.stringify(nb, null, 2);
}


// serverXgbNotebookBuilder.js

/**
 * Build a Jupyter .ipynb (JSON text) that configures and starts a MEDfl FederatedServer
 * using the federated XGBoost strategy.
 *
 * @param {Object} cfg
 * @param {string} cfg.host
 * @param {number} cfg.port
 * @param {number} cfg.num_rounds
 * @param {Object} cfg.strategy           // XGBoostStrategy() kwargs
 * @param {string} cfg.strategy.mode
 * @param {string} cfg.strategy.task
 * @param {number} [cfg.strategy.num_classes]
 * @param {string} cfg.strategy.features
 * @param {string} cfg.strategy.target
 * @param {number} cfg.strategy.local_num_boost_round
 * @param {string} cfg.strategy.xgb_objective
 * @param {string} cfg.strategy.xgb_eval_metric
 * @param {string} cfg.strategy.xgb_tree_method
 * @param {number} cfg.strategy.xgb_max_depth
 * @param {number} cfg.strategy.xgb_eta
 * @param {number} cfg.strategy.xgb_subsample
 * @param {number} cfg.strategy.xgb_colsample_bytree
 * @param {number} cfg.strategy.fraction_fit
 * @param {number} cfg.strategy.fraction_evaluate
 * @param {number} cfg.strategy.min_fit_clients
 * @param {number} cfg.strategy.min_evaluate_clients
 * @param {number} cfg.strategy.min_available_clients
 * @param {number} cfg.strategy.threshold
 * @param {number} cfg.strategy.saveOnRounds
 * @param {number} cfg.strategy.total_rounds
 * @param {number} cfg.strategy.val_fraction
 * @param {number} cfg.strategy.test_fraction
 * @param {string} cfg.strategy.split_mode
 * @param {string} cfg.strategy.id_col
 * @param {Object} cfg.strategy.client_fractions
 * @param {Object|null} [cfg.shap] - The raw flShapNode settings, or null/undefined if SHAP is disabled.
 */
export function buildXgbServerNotebookText(cfg) {
  const host = cfg.host ?? "0.0.0.0";
  const port = cfg.port ?? 8080;
  const num_rounds = cfg.num_rounds ?? 10;
  const shap = cfg.shap ?? null;

  const strategy = {
    mode: "bagging",
    task: "binary",
    num_classes: null,
    features: "",
    target: "",
    local_num_boost_round: 10,
    xgb_objective: "binary:logistic",
    xgb_eval_metric: "auc",
    xgb_tree_method: "hist",
    xgb_max_depth: 6,
    xgb_eta: 0.1,
    xgb_subsample: 1.0,
    xgb_colsample_bytree: 1.0,
    fraction_fit: 1,
    fraction_evaluate: 1,
    min_fit_clients: 1,
    min_evaluate_clients: 1,
    min_available_clients: 1,
    threshold: 0.5,
    saveOnRounds: 1,
    total_rounds: 10,
    val_fraction: 0.10,
    test_fraction: 0.10,
    split_mode: "global",
    id_col: "id",
    client_fractions: {},
    ...(cfg.strategy || {}),
  };

  const mdTitle =
    `# MEDfl Federated XGBoost Server — Strategy & Launch\n` +
    `This notebook builds an **XGBoostStrategy** and starts a **FederatedServer** from \`MEDfl.rw.server\` / \`MEDfl.rw.xgboost.strategy\`.\n\n` +
    `Edit the parameters below as needed before running.\n`;

  const cellImportsXgb =
    `# --- 1) Imports\n` +
    `from MEDfl.rw.server import FederatedServer\n` +
    `from MEDfl.rw.xgboost.strategy import XGBoostStrategy\n` +
    `from MEDfl.LearningManager.shap import SHAPConfig\n`;

  const cellConfigXgb =
    `# --- 2) Server & Strategy configuration\n` +
    `host = ${toPythonLiteral(host)}\n` +
    `port = ${toPythonLiteral(port)}\n` +
    `num_rounds = ${toPythonLiteral(num_rounds)}\n\n` +
    `xgb_params = {\n` +
    `    "objective": ${toPythonLiteral(strategy.xgb_objective)},\n` +
    `    "eval_metric": ${toPythonLiteral(strategy.xgb_eval_metric)},\n` +
    `    "tree_method": ${toPythonLiteral(strategy.xgb_tree_method)},\n` +
    `    "max_depth": ${toPythonLiteral(strategy.xgb_max_depth)},\n` +
    `    "eta": ${toPythonLiteral(strategy.xgb_eta)},\n` +
    `    "subsample": ${toPythonLiteral(strategy.xgb_subsample)},\n` +
    `    "colsample_bytree": ${toPythonLiteral(strategy.xgb_colsample_bytree)},\n` +
    `}\n\n` +
    `strategy_kwargs = {\n` +
    `    "mode": ${toPythonLiteral(strategy.mode)},\n` +
    `    "task": ${toPythonLiteral(strategy.task)},\n` +
    `    "num_classes": ${toPythonLiteral(strategy.num_classes)},\n` +
    `    "features": ${toPythonLiteral(strategy.features)},\n` +
    `    "target": ${toPythonLiteral(strategy.target)},\n` +
    `    "local_num_boost_round": ${toPythonLiteral(strategy.local_num_boost_round)},\n` +
    `    "xgb_params": xgb_params,\n` +
    `    "fraction_fit": ${toPythonLiteral(strategy.fraction_fit)},\n` +
    `    "fraction_evaluate": ${toPythonLiteral(strategy.fraction_evaluate)},\n` +
    `    "min_fit_clients": ${toPythonLiteral(strategy.min_fit_clients)},\n` +
    `    "min_evaluate_clients": ${toPythonLiteral(strategy.min_evaluate_clients)},\n` +
    `    "min_available_clients": ${toPythonLiteral(strategy.min_available_clients)},\n` +
    `    "threshold": ${toPythonLiteral(strategy.threshold)},\n` +
    `    "savingPath": None,\n` +
    `    "saveOnRounds": ${toPythonLiteral(strategy.saveOnRounds)},\n` +
    `    "total_rounds": ${toPythonLiteral(strategy.total_rounds)},\n` +
    `    "val_fraction": ${toPythonLiteral(strategy.val_fraction)},\n` +
    `    "test_fraction": ${toPythonLiteral(strategy.test_fraction)},\n` +
    `    "split_mode": ${toPythonLiteral(strategy.split_mode)},\n` +
    `    "id_col": ${toPythonLiteral(strategy.id_col)},\n` +
    `    "client_fractions": ${toPythonLiteral(strategy.client_fractions)},\n` +
    `}\n`;

  const cellShapXgb = buildShapCell(shap, "tree", 3);

  const cellStrategyXgb =
    `# --- 4) Create XGBoostStrategy\n` +
    `custom_strategy = XGBoostStrategy(**strategy_kwargs)\n` +
    `print("XGBoost strategy created:", custom_strategy)\n`;

  const cellServerXgb =
    `# --- 5) Create FederatedServer\n` +
    `server = FederatedServer(\n` +
    `    host=host,\n` +
    `    port=port,\n` +
    `    num_rounds=num_rounds,\n` +
    `    strategy=custom_strategy,\n` +
    `    shap_config=shap_config,\n` +
    `)\n` +
    `print(f"Server ready at {host}:{port} for {num_rounds} rounds.")\n`;

  const cellStartXgb =
    `# --- 6) Start server (blocking)\n` +
    `server.start()\n`;

  const nbXgb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
      language_info: { name: "python", version: "3.x" },
    },
    cells: [
      { cell_type: "markdown", metadata: {}, source: mdTitle.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellImportsXgb.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellConfigXgb.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellShapXgb.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellStrategyXgb.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellServerXgb.split("\n").map((s) => s + "\n") },
      { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: cellStartXgb.split("\n").map((s) => s + "\n") },
    ],
  };

  return JSON.stringify(nbXgb, null, 2);
}

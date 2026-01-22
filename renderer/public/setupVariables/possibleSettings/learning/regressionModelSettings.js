/* eslint-disable */
const regressionModelSettings = {
    "lr": {
        "options": {
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "n_jobs": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "positive": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, forces the coefficients to be positive."
            }
        },
        "code": "lr",
        "label": "Linear Regression"
    },
    "lasso": {
        "options": {
            "alpha": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Constant that multiplies the penalty terms."
            },
            "l1_ratio": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. The ElasticNet mixing parameter, with 0 <= l1_ratio <= 1. For l1_ratio = 0 the penalty is an L2 penalty. For l1_ratio = 1 it is an L1 penalty. For 0 < l1_ratio < 1, the penalty is a combination of L1 and L2."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "precompute": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Whether to use a precomputed Gram matrix to speed up calculations."
            },
            "max_iter": {
                "type": "int",
                "default_val": "1000",
                "tooltip": "int, default=1000. The maximum number of iterations to be run."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "positive": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, forces the coefficients to be positive."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. The seed of the pseudo random number generator that selects a random feature to update."          
              },
            "selection": {
                "type": "list",
                "default_val": "cyclic",
                "tooltip": "<p>Feature update strategy during optimization. Default = <code>cyclic</code>.</p>\n<ul>\n<li><code>cyclic</code>: Updates features sequentially.</li>\n<li><code>random</code>: Updates a random feature at each iteration.</li>\n</ul>",
                "choices": {
                    "cyclic": "Cyclic (default)",
                    "random": "Random"
                }
        }

        },
        "code": "lasso",
        "label": "Lasso Regression"
    },
    "ridge": {
        "options": {
            "alpha": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Constant that multiplies the penalty terms."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "max_iter": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The maximum number of iterations to be run."
            },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            },
            "solver": {
                "type": "list",
                "default_val": "auto",
                "tooltip": "<p>Algorithm used to solve the optimization problem. Default = <code>auto</code>.</p>\n<ul>\n<li><code>auto</code>: Automatically chooses the best solver based on the data.</li>\n<li><code>svd</code>: Singular Value Decomposition.</li>\n<li><code>cholesky</code>: Uses the Cholesky decomposition.</li>\n<li><code>lsqr</code>: Least squares approach via QR decomposition.</li>\n<li><code>sparse_cg</code>: Conjugate gradient for sparse data.</li>\n<li><code>sag</code>: Stochastic Average Gradient.</li>\n<li><code>saga</code>: Variant of SAG that supports L1.</li>\n</ul>",
                "choices": {
                    "auto": "Auto (default)",
                    "svd": "Singular Value Decomposition",
                    "cholesky": "Cholesky Decomposition",
                    "lsqr": "Least Squares (QR)",
                    "sparse_cg": "Sparse Conjugate Gradient",
                    "sag": "Stochastic Average Gradient (SAG)",
                    "saga": "SAGA"
                }
            },
            "positive": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, forces the coefficients to be positive."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Used when solver == ‘sag’ or ‘saga’ to shuffle the data."     
             }
        },
        "code": "ridge",
        "label": "Ridge Regression"
    },
    "en": {
        "options": {
            "alpha": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Constant that multiplies the penalty terms."
            },
            "l1_ratio": {
                "type": "float",
                "default_val": "0.5",
                "tooltip": "float, default=0.5. The ElasticNet mixing parameter, with 0 <= l1_ratio <= 1. For l1_ratio = 0 the penalty is an L2 penalty. For l1_ratio = 1 it is an L1 penalty. For 0 < l1_ratio < 1, the penalty is a combination of L1 and L2."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "precompute": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Whether to use a precomputed Gram matrix to speed up calculations."
            },
            "max_iter": {
                "type": "int",
                "default_val": "1000",
                "tooltip": "int, default=1000. The maximum number of iterations to be run."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "positive": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, forces the coefficients to be positive."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. The seed of the pseudo random number generator that selects a random feature to update."          
             },
            "selection": {
                "type": "list",
                "default_val": "cyclic",
                "tooltip": "<p>Feature selection strategy. Default = <code>cyclic</code>.</p>\n<ul>\n<li><code>cyclic</code>: Updates coefficients sequentially.</li>\n<li><code>random</code>: Updates a random coefficient at each iteration.</li>\n</ul>",
                "choices": {
                    "cyclic": "Cyclic (default)",
                    "random": "Random"
                }
                }
        },
        "code": "en",
        "label": "Elastic Net"
    },
    "lar": {
        "options": {
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "verbose": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Sets the verbosity amount."
            },
            "normalize": {
                "type": "string",
                "default_val": "deprecated",
                "tooltip": "deprecated"
            },
            "precompute": {
                "type": "list",
                "default_val": "auto",
                "tooltip": "<p>Whether to precompute the Gram matrix for speed. Default = <code>auto</code>. Automatically decides based on the dataset size and structure.</p>",
                "choices": {
                    "auto": "Auto (default)"
                }
            },
            "n_nonzero_coefs": {
                "type": "int",
                "default_val": "500",
                "tooltip": "int, default=500. Target number of non-zero coefficients."
            },
            "eps": {
                "type": "float64",
                "default_val": "2.220446049250313e-16",
                "tooltip": "float64, default=2.220446049250313e-16. The machine-precision regularization in the computation of the Cholesky diagonal factors."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "fit_path": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True the full path is stored in the coef_path_ attribute."
            },
            "jitter": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Upper bound on a uniform noise parameter to be added to the y values, to satisfy the model’s assumption of one-at-a-time computations."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Determines random number generation for jittering."       
                 }
        },
        "code": "lar",
        "label": "Least Angle Regression"
    },
    "llar": {
        "options": {
            "alpha": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Constant that multiplies the penalty terms."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "max_iter": {
                "type": "int",
                "default_val": "500",
                "tooltip": "int, default=500. The maximum number of iterations to be run."
            },
            "verbose": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Sets the verbosity amount."
            },
            "normalize": {
                "type": "string",
                "default_val": "deprecated",
                "tooltip": "deprecated"
            },
            "positive": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, forces the coefficients to be positive."
            },
            "precompute": {
                "type": "list",
                "default_val": "auto",
                "tooltip": "<p>Whether to precompute the Gram matrix for speed. Default = <code>auto</code>. Automatically decides based on the dataset size and structure.</p>",
                "choices": {
                    "auto": "Auto (default)"
                }
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "eps": {
                "type": "float64",
                "default_val": "2.220446049250313e-16",
                "tooltip": "float64, default=2.220446049250313e-16. The machine-precision regularization in the computation of the Cholesky diagonal factors."
            },
            "fit_path": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True the full path is stored in the coef_path_ attribute."
            },
            "jitter": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Upper bound on a uniform noise parameter to be added to the y values, to satisfy the model’s assumption of one-at-a-time computations."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Determines random number generation for jittering."       
               }
        },
        "code": "llar",
        "label": "Lasso Least Angle Regression"
    },
    "omp": {
        "options": {
            "n_nonzero_coefs": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Desired number of non-zero entries in the solution."
            },
            "tol": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "float, default=None. Tolerance for stopping criteria."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "normalize": {
                "type": "string",
                "default_val": "deprecated",
                "tooltip": "deprecated"
            },
            "precompute": {
            "type": "list",
            "default_val": "auto",
            "tooltip": "<p>Whether to precompute the Gram matrix for speed. Default = <code>auto</code>. Automatically decides based on the dataset size and structure.</p>",
            "choices": {
                "auto": "Auto (default)"
            }
            }
        },
        "code": "omp",
        "label": "Orthogonal Matching Pursuit"
    },
    "br": {
        "options": {
            "n_iter": {
                "type": "int",
                "default_val": "300",
				"tooltip": "int, default=300, The actual number of iterations to reach the stopping criterion."
            },
            "tol": {
                "type": "float",
                "default_val": "0.001",
                "tooltip": "float, default=0.001. Tolerance for stopping criteria."
            },
            "alpha_1": {
                "type": "float",
                "default_val": "1e-06",
				"tooltip": "float, default=1e-06. Hyper-parameter : shape parameter for the Gamma distribution prior over the alpha parameter."
            },
            "alpha_2": {
                "type": "float",
                "default_val": "1e-06",
                "tooltip": "float, default=1e-06. Hyper-parameter : inverse scale parameter (rate parameter) for the Gamma distribution prior over the alpha parameter."
            },
            "lambda_1": {
                "type": "float",
                "default_val": "1e-06",
                "tooltip": "float, default=1e-06. Hyper-parameter : shape parameter for the Gamma distribution prior over the lambda parameter."
            },
            "lambda_2": {
                "type": "float",
                "default_val": "1e-06",
                "tooltip": "float, default=1e-06. Hyper-parameter : inverse scale parameter (rate parameter) for the Gamma distribution prior over the lambda parameter."
            },
            "alpha_init": {
                "type": "NoneType",
                "default_val": "None",
				"tooltip": "NoneType, default=None. Initial value for alpha (precision of the noise)."
            },
            "lambda_init": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Initial value for lambda (precision of the weights). If not set, lambda_init is 1."
            },
            "compute_score": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. If True, compute the objective function at each step of the model."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "verbose": {
                "type": "bool",
                "default_val": "False",
				"tooltip": "bool, default=False. Verbose mode when fitting the model."
            }
        },
        "code": "br",
        "label": "Bayesian Ridge"
    },
    "ard": {
        "options": {
            "n_iter": {
                "type": "int",
                "default_val": "1000",
				"tooltip": "int, default=1000, The actual number of iterations to reach the stopping criterion."
            },
            "tol": {
                "type": "float",
                "default_val": "0.001",
                "tooltip": "float, default=0.001. Tolerance for stopping criteria."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "alpha_1": {
                "type": "float",
                "default_val": "1e-06",
				"tooltip": "float, default=1e-06. Hyper-parameter : shape parameter for the Gamma distribution prior over the alpha parameter."
            },
            "alpha_2": {
                "type": "float",
                "default_val": "1e-06",
                "tooltip": "float, default=1e-06. Hyper-parameter : inverse scale parameter (rate parameter) for the Gamma distribution prior over the alpha parameter."
            },
            "lambda_1": {
                "type": "float",
                "default_val": "1e-06",
                "tooltip": "float, default=1e-06. Hyper-parameter : shape parameter for the Gamma distribution prior over the lambda parameter."
            },
            "lambda_2": {
                "type": "float",
                "default_val": "1e-06",
                "tooltip": "float, default=1e-06. Hyper-parameter : inverse scale parameter (rate parameter) for the Gamma distribution prior over the lambda parameter."
            },
            "compute_score": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. If True, compute the objective function at each step of the model."
            },
            "threshold_lambda": {
                "type": "float",
                "default_val": "10000.0",
				"tooltip": "float, default=10000.0. Threshold for removing (pruning) weights with high precision from the computation."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "verbose": {
                "type": "bool",
                "default_val": "False",
				"tooltip": "bool, default=False. Verbose mode when fitting the model."
            }
        },
        "code": "ard",
        "label": "Automatic Relevance Determination"
    },
    "par": {
        "options": {
            "loss": {
                "type": "list",
                "default_val": "epsilon_insensitive",
                "tooltip": "<p>Loss function used in regression tasks. Default = <code>epsilon_insensitive</code>.</p>\n<ul>\n<li><code>squared_error</code>: Ordinary least squares (L2 loss)</li>\n<li><code>huber</code>: Robust loss function, tolerant to outliers</li>\n<li><code>epsilon_insensitive</code>: Ignores errors within epsilon margin</li>\n<li><code>squared_epsilon_insensitive</code>: Same as above, but with squared penalty</li>\n</ul>",
                "choices": {
                    "squared_error": "Squared Error (L2)",
                    "huber": "Huber",
                    "epsilon_insensitive": "Epsilon Insensitive (default)",
                    "squared_epsilon_insensitive": "Squared Epsilon Insensitive"
                }
            },
            "penalty": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "{‘l1’, ‘l2’}, default=’None’ Specifies the norm used in the penalization. The ‘l2’ penalty is the standard used in SVC. The ‘l1’ leads to coef_ vectors that are sparse."
            },
            "learning_rate": {
                "type": "list",
                "default_val": "invscaling",
                "tooltip": "<p>Learning rate schedule. Default = <code>invscaling</code>.</p>\n<ul>\n<li><code>constant</code>: η = η₀ (fixed learning rate)</li>\n<li><code>optimal</code>: η = 1 / (α × (t + t₀)), recommended for SGD</li>\n<li><code>invscaling</code>: η = η₀ / t<sup>power_t</sup></li>\n<li><code>adaptive</code>: Keeps η = η₀ as long as training improves</li>\n</ul>",
                "choices": {
                    "constant": "Constant",
                    "optimal": "Optimal",
                    "invscaling": "Inverse Scaling (default)",
                    "adaptive": "Adaptive"
                }
            },
            "epsilon": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. Epsilon in the epsilon-insensitive loss functions; only if loss is ‘huber’, ‘epsilon_insensitive’, or ‘squared_epsilon_insensitive’. For ‘huber’, determines the threshold at which it becomes less important to get the prediction exactly right. For epsilon-insensitive, any differences between the current prediction and the correct label are ignored if they are less than this threshold. Values must be in the range [0.0, inf)"
            },
            "alpha": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Constant that multiplies the penalty terms."
            },
            "C": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Regularization parameter. The strength of the regularization is inversely proportional to C. Must be strictly positive."
            },
            "l1_ratio": {
                "type": "int",
                "default_val": "0",
                "tooltip": "int, default=0. The ElasticNet mixing parameter."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "shuffle": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. Whether or not the training data should be shuffled after each epoch."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=0. Used to shuffle the training data."
                        },
            "verbose": {
                "type": "int",
                "default_val": "0",
                "tooltip": "int, default=0. The verbosity level."
            },
            "eta0": {
                "type": "float",
                "default_val": "1.0",
				"tooltip": "float, default=1.0. The initial learning rate for the ‘constant’, ‘invscaling’ or ‘adaptive’ schedules. The default value is 0.0 as eta0 is not used by the default schedule ‘optimal’. Values must be in the range [0.0, inf)."
            },
            "power_t": {
                "type": "float",
                "default_val": "0.25",
                "tooltip": "float, default=0.25. The exponent for inverse scaling learning rate. Values must be in the range (-inf, inf)."
            },
            "early_stopping": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default='False'. Use early stopping to stop fitting to a hyperparameter configuration if it performs poorly. Ignored when search_library is scikit-learn, or if the estimator does not have ‘partial_fit’ attribute. If False or None, early stopping will not be used. "
            },
            "validation_fraction": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. The proportion of training data to set aside as validation set for early stopping. Must be between 0 and 1. Only used if early_stopping is True. Values must be in the range (0.0, 1.0)."
            },
            "n_iter_no_change": {
                "type": "int",
                "default_val": "5",
                "tooltip": "int, default=5. Number of iterations with no improvement to wait before stopping fitting. Convergence is checked against the training loss or the validation loss depending on the early_stopping parameter. Integer values must be in the range [1, max_iter)."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "average": {
                "type": "bool",
                "default_val": "False",
				"tooltip": "bool, default=False. When set to True, computes the averaged SGD weights across all updates and stores the result in the coef_ attribute."
            },
            "max_iter": {
                "type": "int",
                "default_val": "1000",
                "tooltip": "int, default=1000. The maximum number of iterations to be run."
            },
            "tol": {
                "type": "float",
                "default_val": "0.001",
                "tooltip": "float, default=0.001. Tolerance for stopping criteria."
            }
        },
        "code": "par",
        "label": "Passive Aggressive Regressor"
    },
    "ransac": {
        "options": {
            "estimator": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default='None'. The base estimator from which the boosted ensemble is built. Support for sample weighting is required, as well as proper classes_ and n_classes_ attributes. If None, then the base estimator is DecisionTreeClassifier initialized with max_depth=1."
            },
            "min_samples": {
                "type": "NoneType",
                "default_val": "None",
				"tooltip": "NoneType, default=None. Minimum number of samples chosen randomly from original data"
            },
            "residual_threshold": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Maximum residual for a data sample to be classified as an inlier. "
            },
            "is_data_valid": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. This function is called with the randomly selected data before the model is fitted to it:"
            },
            "is_model_valid": {
                "type": "NoneType",
                "default_val": "None",
				"tooltip": "NoneType, default=None. This function is called with the estimated model and the randomly selected data:"
            },
            "max_trials": {
                "type": "int",
                "default_val": "100",
                "tooltip": "int, default=100. Maximum number of iterations for random sample selection."
            },
            "max_skips": {
                "type": "float",
                "default_val": "inf",
				"tooltip": "int, default=inf. Maximum number of iterations that can be skipped due to finding zero inliers or invalid data"
            },
            "stop_n_inliers": {
                "type": "float",
                "default_val": "inf",
                "tooltip": "int, default=inf. Stop iteration if at least this number of inliers are found."
            },
            "stop_score": {
                "type": "float",
                "default_val": "inf",
				"tooltip": "float, default=inf. Stop iteration if score is greater equal than this threshold."
            },
            "stop_probability": {
                "type": "float",
                "default_val": "0.99",
                "tooltip": "float, default=0.99. RANSAC iteration stops if at least one outlier-free set of the training data is sampled in RANSAC. "
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771, The generator used to initialize the centers"          
              },
            "loss": {
                "type": "list",
                "default_val": "absolute_error",
                "tooltip": "<p>Loss function used for regression. Default = <code>absolute_error</code>.</p>\n<ul>\n<li><code>squared_error</code>: L2 loss (mean squared error)</li>\n<li><code>absolute_error</code>: L1 loss (mean absolute error)</li>\n<li><code>huber</code>: Combines L1 and L2, robust to outliers</li>\n<li><code>quantile</code>: For quantile regression</li>\n</ul>",
                "choices": {
                    "squared_error": "Squared Error (MSE)",
                    "absolute_error": "Absolute Error (MAE, default)",
                    "huber": "Huber",
                    "quantile": "Quantile"
                }
            },
            "base_estimator": {
                "type": "string",
                "default_val": "deprecated",
                "tooltip": "String, default='deprecated'. The base estimator from which the ensemble is grown."
            }
        },
        "code": "ransac",
        "label": "RANSAC Regressor"
    },
    "tr": {
        "options": {
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "copy_X": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. If True, X will be copied; else, it may be overwritten."
            },
            "max_subpopulation": {
                "type": "float",
                "default_val": "10000.0",
				"tooltip": "int, default=10000.0. Instead of computing with a set of cardinality ‘n choose k’, where n is the number of samples and k is the number of subsamples (at least number of features), consider only a stochastic subpopulation of a given maximal size if ‘n choose k’ is larger than max_subpopulation. "
            },
            "n_subsamples": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Number of samples to calculate the parameters. This is at least the number of features (plus 1 if fit_intercept=True) and the number of samples as a maximum."
            },
            "max_iter": {
                "type": "int",
                "default_val": "1000",
                "tooltip": "int, default=1000. The maximum number of iterations to be run."
            },
            "tol": {
                "type": "float",
                "default_val": "0.001",
                "tooltip": "float, default=0.001. Tolerance for stopping criteria."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. A random number generator instance to define the state of the random permutations generator. "      
                  },
            "n_jobs": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "verbose": {
                "type": "bool",
                "default_val": "False",
				"tooltip": "bool, default=False. Verbose mode when fitting the model."
            }
        },
        "code": "tr",
        "label": "Theil-Sen Regressor"
    },
    "huber": {
        "options": {
            "epsilon": {
                "type": "float",
                "default_val": "1.35",
                "tooltip": "float, default=1.35. Epsilon in the epsilon-insensitive loss functions; only if loss is ‘huber’, ‘epsilon_insensitive’, or ‘squared_epsilon_insensitive’. For ‘huber’, determines the threshold at which it becomes less important to get the prediction exactly right. For epsilon-insensitive, any differences between the current prediction and the correct label are ignored if they are less than this threshold. Values must be in the range [0.0, inf)"
            },
            "max_iter": {
                "type": "int",
                "default_val": "100",
                "tooltip": "int, default=100. The maximum number of iterations to be run."
            },
            "alpha": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Constant that multiplies the penalty terms."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "tol": {
                "type": "float",
                "default_val": "1e-05",
                "tooltip": "float, default=1e-05. Tolerance for stopping criteria."
            }
        },
        "code": "huber",
        "label": "Huber Regressor"
    },
    "kr": {
        "options": {
            "alpha": {
                "type": "int",
                "default_val": "1",
                "tooltip": "int, default=1. Regularization strength."
            },
            "kernel": {
                "type": "list",
                "default_val": "linear",
                "tooltip": "<p>Specifies the kernel type used in Kernel Ridge Regression. Default = <code>linear</code>.</p>\n<ul>\n<li><code>linear</code>: Linear kernel</li>\n<li><code>poly</code>: Polynomial kernel</li>\n<li><code>rbf</code>: Radial basis function (Gaussian kernel)</li>\n<li><code>sigmoid</code>: Sigmoid kernel</li>\n<li><code>cosine</code>: Cosine similarity kernel</li>\n<li><code>precomputed</code>: Use a precomputed kernel matrix</li>\n</ul>",
                "choices": {
                    "linear": "Linear (default)",
                    "poly": "Polynomial",
                    "rbf": "RBF",
                    "sigmoid": "Sigmoid",
                    "cosine": "Cosine",
                    "precomputed": "Precomputed"
                }
            },
            "gamma": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Kernel coefficient for ‘rbf’, ‘poly’ and ‘sigmoid’."
            },
            "degree": {
                "type": "int",
                "default_val": "3",
				"tooltip": "int, default=3. Degree of the polynomial kernel function (‘poly’). Must be non-negative. Ignored by all other kernels."
            },
            "coef0": {
                "type": "int",
                "default_val": "1",
                "tooltip": "int, default=1. Zero coefficient for polynomial and sigmoid kernels. Ignored by other kernels."
            },
            "kernel_params": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Additional parameters (keyword arguments) for kernel function passed as callable object."
            }
        },
        "code": "kr",
        "label": "Kernel Ridge"
    },
    "svm": {
        "options": {
           "kernel": {
                "type": "list",
                "default_val": "rbf",
                "tooltip": "<p>Specifies the kernel type to be used in the SVM algorithm. Default = <code>rbf</code>.</p>\n<ul>\n<li><code>linear</code>: Linear kernel</li>\n<li><code>poly</code>: Polynomial kernel</li>\n<li><code>rbf</code>: Radial Basis Function (default)</li>\n<li><code>sigmoid</code>: Sigmoid kernel</li>\n<li><code>precomputed</code>: Kernel matrix must be precomputed</li>\n</ul>",
                "choices": {
                    "linear": "Linear",
                    "poly": "Polynomial",
                    "rbf": "RBF (default)",
                    "sigmoid": "Sigmoid",
                    "precomputed": "Precomputed"
                }
            },
            "degree": {
                "type": "int",
                "default_val": "3",
				"tooltip": "int, default=3. Degree of the polynomial kernel function (‘poly’). Must be non-negative. Ignored by all other kernels."
            },
            "gamma": {
                "type": "list",
                "default_val": "scale",
                "tooltip": "<p>Kernel coefficient for <code>rbf</code>, <code>poly</code> and <code>sigmoid</code> kernels. Default = <code>scale</code>.</p>\n<ul>\n<li><code>scale</code>: 1 / (n_features × X.var())</li>\n<li><code>auto</code>: 1 / n_features</li>\n</ul>",
                "choices": {
                    "scale": "Scale (default)",
                    "auto": "Auto"
                }
            },
            "coef0": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. Independent term in kernel function. It is only significant in ‘poly’ and ‘sigmoid’."
            },
            "tol": {
                "type": "float",
                "default_val": "0.001",
                "tooltip": "float, default=0.001. Tolerance for stopping criteria."
            },
            "C": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Regularization parameter. The strength of the regularization is inversely proportional to C. Must be strictly positive."
            },
            "nu": {
                "type": "float",
                "default_val": "0.0",
				"tooltip": "float, default=0.0. An upper bound on the fraction of margin errors and a lower bound of the fraction of support vectors."
            },
            "epsilon": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. Epsilon in the epsilon-insensitive loss functions; only if loss is ‘huber’, ‘epsilon_insensitive’, or ‘squared_epsilon_insensitive’. For ‘huber’, determines the threshold at which it becomes less important to get the prediction exactly right. For epsilon-insensitive, any differences between the current prediction and the correct label are ignored if they are less than this threshold. Values must be in the range [0.0, inf)"
            },
            "shrinking": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. Whether to use the shrinking heuristic."
            },
            "probability": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Whether to enable probability estimates."
            },
            "cache_size": {
                "type": "int",
                "default_val": "200",
                "tooltip": "int, default=200. Specify the size of the kernel cache (in MB)."
            },
            "class_weight": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Set the parameter C of class i to class_weight[i]*C for SVC. If not given, all classes are supposed to have weight one. The “balanced” mode uses the values of y to automatically adjust weights inversely proportional to class frequencies in the input data as n_samples / (n_classes * np.bincount(y))."
            },
            "verbose": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Enable verbose output."
            },
            "max_iter": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. The maximum number of iterations to be run."
            },
            "random_state": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The seed of the pseudo random number generator to use when shuffling the data."        
                }
        },
        "code": "svm",
        "label": "Support Vector Machine"
    },
    "knn": {
        "options": {
            "n_neighbors": {
                "type": "int",
                "default_val": "5",
                "tooltip": "int, default=5. Number of neighboring samples to use for imputation."
            },
            "radius": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Limiting distance of neighbors to return. If radius is a float, then n_neighbors must be set to None."
            },
            "algorithm": {
                "type": "list",
                "default_val": "auto",
                "tooltip": "<p>Algorithm used to compute the nearest neighbors. Default = <code>auto</code>.</p>\n<ul>\n<li><code>auto</code>: Chooses the best algorithm based on data</li>\n<li><code>ball_tree</code>: Uses BallTree</li>\n<li><code>kd_tree</code>: Uses KDTree</li>\n<li><code>brute</code>: Brute-force search</li>\n</ul>",
                "choices": {
                    "auto": "Auto (default)",
                    "ball_tree": "BallTree",
                    "kd_tree": "KDTree",
                    "brute": "Brute Force"
                }
            },
            "leaf_size": {
                "type": "int",
                "default_val": "30",
                "tooltip": "int, default=30. Leaf size passed to BallTree or KDTree. This can affect the speed of the construction and query, as well as the memory required to store the tree. The optimal value depends on the nature of the problem."
            },
            "metric": {
                "type": "list",
                "default_val": "minkowski",
                "tooltip": "<p>Distance metric for nearest neighbor search. Default = <code>minkowski</code>.</p>\n<ul>\n<li><code>euclidean</code>: Standard L2 distance</li>\n<li><code>manhattan</code>: L1 distance</li>\n<li><code>chebyshev</code>: L∞ distance</li>\n<li><code>minkowski</code>: Generalized distance (default)</li>\n<li><code>cosine</code>: Cosine distance</li>\n<li><code>hamming</code>: Fraction of non-matching components</li>\n<li><code>precomputed</code>: Use a precomputed distance matrix</li>\n</ul>",
                "choices": {
                    "minkowski": "Minkowski (default)",
                    "euclidean": "Euclidean",
                    "manhattan": "Manhattan",
                    "chebyshev": "Chebyshev",
                    "cosine": "Cosine",
                    "hamming": "Hamming",
                    "precomputed": "Precomputed"
                }
             },
            "metric_params": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Additional keyword arguments for the metric function."
            },
            "p": {
                "type": "int",
                "default_val": "2",
                "tooltip": "float, default=2. Parameter for the Minkowski metric from pairwise_distances. When p = 1, this is equivalent to using manhattan_distance (l1), and euclidean_distance (l2) for p = 2. For arbitrary p, minkowski_distance (l_p) is used."
            },
            "n_jobs": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "weights": {
            "type": "list",
            "default_val": "uniform",
            "tooltip": "<p>Weight function used in prediction. Default = <code>uniform</code>.</p>\n<ul>\n<li><code>uniform</code>: All neighbors are weighted equally</li>\n<li><code>distance</code>: Closer neighbors have greater influence</li>\n<li><code>callable</code>: You can also provide a custom function (not available via UI)</li>\n</ul>",
            "choices": {
                "uniform": "Uniform (default)",
                "distance": "Distance"
            }
            }
        },
        "code": "knn",
        "label": "K-Nearest Neighbors"
    },
    "dt": {
        "options": {
            "criterion": {
                "type": "list",
                "default_val": "squared_error",
                "tooltip": "<p>Function to measure the quality of a split. Default = <code>squared_error</code>.</p>\n<ul>\n<li><code>squared_error</code>: Mean squared error (MSE)</li>\n<li><code>absolute_error</code>: Mean absolute error (MAE)</li>\n<li><code>poisson</code>: For count data</li>\n<li><code>friedman_mse</code>: MSE with improvement score (for GBDTs)</li>\n</ul>",
                "choices": {
                    "squared_error": "Mean Squared Error (default)",
                    "absolute_error": "Mean Absolute Error",
                    "poisson": "Poisson",
                    "friedman_mse": "Friedman MSE"
                }
            },
            "splitter": {
                "type": "list",
                "default_val": "best",
                "tooltip": "<p>Strategy used to choose the split at each node. Default = <code>best</code>.</p>\n<ul>\n<li><code>best</code>: Chooses the best split</li>\n<li><code>random</code>: Chooses the best random split</li>\n</ul>",
                "choices": {
                    "best": "Best (default)",
                    "random": "Random"
                }
            },
            "max_depth": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "min_samples_split": {
                "type": "int",
                "default_val": "2",
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": "1",
                "tooltip": "int, default=1. The minimum number of samples required to be at a leaf node. A split point at any depth will only be considered if it leaves at least min_samples_leaf training samples in each of the left and right branches. This may have the effect of smoothing the model, especially in regression."
            },
            "min_weight_fraction_leaf": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. The minimum weighted fraction of the sum total of weights (of all the input samples) required to be at a leaf node. Samples have equal weight when sample_weight is not provided."
            },
            "max_features": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=”None”. The number of features to consider when looking for the best split: If int, then consider max_features features at each split. If float, then max_features is a fraction and max(1, int(max_features * n_features_in_)) features are considered at each split. If “sqrt”, then max_features=sqrt(n_features).If “log2”, then max_features=log2(n_features) If None, then max_features=n_features."
            },
            "max_leaf_nodes": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Grow a tree with max_leaf_nodes in best-first fashion. Best nodes are defined as relative reduction in impurity. If None then unlimited number of leaf nodes."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Controls the randomness of the estimator."         
             },
            "min_impurity_decrease": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. A node will be split if this split induces a decrease of the impurity greater than or equal to this value."
            },
            "class_weight": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Set the parameter C of class i to class_weight[i]*C for SVC. If not given, all classes are supposed to have weight one. The “balanced” mode uses the values of y to automatically adjust weights inversely proportional to class frequencies in the input data as n_samples / (n_classes * np.bincount(y))."
            },
            "ccp_alpha": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. Complexity parameter used for Minimal Cost-Complexity Pruning. The subtree with the largest cost complexity that is smaller than ccp_alpha will be chosen. By default, no pruning is performed."
            }
        },
        "code": "dt",
        "label": "Decision Tree Regressor"
    },
    "rf": {
        "options": {
            "estimator": {
                "type": "DecisionTreeRegressor",
                "default_val": "DecisionTreeRegressor()",
                "tooltip": "Object, default='DecisionTreeRegressor'. The base estimator from which the boosted ensemble is built. Support for sample weighting is required, as well as proper classes_ and n_classes_ attributes. If None, then the base estimator is DecisionTreeClassifier initialized with max_depth=1."
            },
            "n_estimators": {
                "type": "int",
                "default_val": "100",
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "estimator_params": {
                "type": "tuple",
                "default_val": "('criterion', 'max_depth', 'min_samples_split', 'min_samples_leaf', 'min_weight_fraction_leaf', 'max_features', 'max_leaf_nodes', 'min_impurity_decrease', 'random_state', 'ccp_alpha')",
                "tooltip": "tuple, default=('criterion', 'max_depth', 'min_samples_split', 'min_samples_leaf', 'min_weight_fraction_leaf', 'max_features', 'max_leaf_nodes', 'min_impurity_decrease', 'random_state', 'ccp_alpha')"
            },
            "base_estimator": {
                "type": "string",
                "default_val": "deprecated",
                "tooltip": "String, default='deprecated'. The base estimator from which the ensemble is grown."
            },
            "bootstrap": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. Whether samples are drawn with replacement. If False, sampling without replacement is performed."
            },
            "oob_score": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Whether to use out-of-bag samples to estimate the generalization error. Only available if bootstrap=True."
            },
            "n_jobs": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Controls the random resampling of the original dataset (sample wise and feature wise). "          
                  },
            "verbose": {
                "type": "int",
                "default_val": "0",
                "tooltip": "int, default=0. Controls the verbosity when fitting and predicting."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "class_weight": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Set the parameter C of class i to class_weight[i]*C for SVC. If not given, all classes are supposed to have weight one. The “balanced” mode uses the values of y to automatically adjust weights inversely proportional to class frequencies in the input data as n_samples / (n_classes * np.bincount(y))."
            },
            "max_samples": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The number of samples to draw from X to train each base estimator "
            },
            "criterion": {
                "type": "string",
                "default_val": "squared_error",
                "tooltip": "String, default=”squared_error”. The function to measure the quality of a split. Supported criteria are “gini” for the Gini impurity and “log_loss” and “entropy” both for the Shannon information gain"
            },
            "max_depth": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "min_samples_split": {
                "type": "int",
                "default_val": "2",
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": "1",
                "tooltip": "int, default=1. The minimum number of samples required to be at a leaf node. A split point at any depth will only be considered if it leaves at least min_samples_leaf training samples in each of the left and right branches. This may have the effect of smoothing the model, especially in regression."
            },
            "min_weight_fraction_leaf": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. The minimum weighted fraction of the sum total of weights (of all the input samples) required to be at a leaf node. Samples have equal weight when sample_weight is not provided."
            },
            "max_features": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1,0. The number of features to consider when looking for the best split: If int, then consider max_features features at each split. If float, then max_features is a fraction and max(1, int(max_features * n_features_in_)) features are considered at each split. If “sqrt”, then max_features=sqrt(n_features).If “log2”, then max_features=log2(n_features) If None, then max_features=n_features."
            },
            "max_leaf_nodes": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Grow a tree with max_leaf_nodes in best-first fashion. Best nodes are defined as relative reduction in impurity. If None then unlimited number of leaf nodes."
            },
            "min_impurity_decrease": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. A node will be split if this split induces a decrease of the impurity greater than or equal to this value."
            },
            "ccp_alpha": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. Complexity parameter used for Minimal Cost-Complexity Pruning. The subtree with the largest cost complexity that is smaller than ccp_alpha will be chosen. By default, no pruning is performed."
            }
        },
        "code": "rf",
        "label": "Random Forest Regressor"
    },
    "et": {
        "options": {
            "estimator": {
                "type": "ExtraTreeRegressor",
                "default_val": "ExtraTreeRegressor()",
                "tooltip": "Object, default='ExtraTreeRegressor'. The base estimator from which the boosted ensemble is built. Support for sample weighting is required, as well as proper classes_ and n_classes_ attributes. If None, then the base estimator is DecisionTreeClassifier initialized with max_depth=1."
            },
            "n_estimators": {
                "type": "int",
                "default_val": "100",
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "estimator_params": {
                "type": "tuple",
                "default_val": "('criterion', 'max_depth', 'min_samples_split', 'min_samples_leaf', 'min_weight_fraction_leaf', 'max_features', 'max_leaf_nodes', 'min_impurity_decrease', 'random_state', 'ccp_alpha')",
                "tooltip": "tuple, default=('criterion', 'max_depth', 'min_samples_split', 'min_samples_leaf', 'min_weight_fraction_leaf', 'max_features', 'max_leaf_nodes', 'min_impurity_decrease', 'random_state', 'ccp_alpha')"
            },
            "base_estimator": {
                "type": "string",
                "default_val": "deprecated",
                "tooltip": "String, default='deprecated'. The base estimator from which the ensemble is grown."
            },
            "bootstrap": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Whether samples are drawn with replacement. If False, sampling without replacement is performed."
            },
            "oob_score": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. Whether to use out-of-bag samples to estimate the generalization error. Only available if bootstrap=True."
            },
            "n_jobs": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Controls the random resampling of the original dataset (sample wise and feature wise). "          
                 },
            "verbose": {
                "type": "int",
                "default_val": "0",
                "tooltip": "int, default=0. Controls the verbosity when fitting and predicting."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "class_weight": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Set the parameter C of class i to class_weight[i]*C for SVC. If not given, all classes are supposed to have weight one. The “balanced” mode uses the values of y to automatically adjust weights inversely proportional to class frequencies in the input data as n_samples / (n_classes * np.bincount(y))."
            },
            "max_samples": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The number of samples to draw from X to train each base estimator "
            },
            "criterion": {
                "type": "string",
                "default_val": "squared_error",
                "tooltip": "String, default=”squared_error”. The function to measure the quality of a split. Supported criteria are “gini” for the Gini impurity and “log_loss” and “entropy” both for the Shannon information gain"
            },
            "max_depth": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "min_samples_split": {
                "type": "int",
                "default_val": "2",
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": "1",
                "tooltip": "int, default=1. The minimum number of samples required to be at a leaf node. A split point at any depth will only be considered if it leaves at least min_samples_leaf training samples in each of the left and right branches. This may have the effect of smoothing the model, especially in regression."
            },
            "min_weight_fraction_leaf": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. The minimum weighted fraction of the sum total of weights (of all the input samples) required to be at a leaf node. Samples have equal weight when sample_weight is not provided."
            },
            "max_features": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1,0. The number of features to consider when looking for the best split: If int, then consider max_features features at each split. If float, then max_features is a fraction and max(1, int(max_features * n_features_in_)) features are considered at each split. If “sqrt”, then max_features=sqrt(n_features).If “log2”, then max_features=log2(n_features) If None, then max_features=n_features."
            },
            "max_leaf_nodes": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Grow a tree with max_leaf_nodes in best-first fashion. Best nodes are defined as relative reduction in impurity. If None then unlimited number of leaf nodes."
            },
            "min_impurity_decrease": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. A node will be split if this split induces a decrease of the impurity greater than or equal to this value."
            },
            "ccp_alpha": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. Complexity parameter used for Minimal Cost-Complexity Pruning. The subtree with the largest cost complexity that is smaller than ccp_alpha will be chosen. By default, no pruning is performed."
            }
        },
        "code": "et",
        "label": "Extra Trees Regressor"
    },
    "ada": {
        "options": {
            "estimator": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default='None'. The base estimator from which the boosted ensemble is built. Support for sample weighting is required, as well as proper classes_ and n_classes_ attributes. If None, then the base estimator is DecisionTreeClassifier initialized with max_depth=1."
            },
            "n_estimators": {
                "type": "int",
                "default_val": "50",
                "tooltip": "int, default=50. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "estimator_params": {
                "type": "tuple",
                "default_val": "()",
                "tooltip": "tuple, default='()'"
            },
            "base_estimator": {
                "type": "string",
                "default_val": "deprecated",
                "tooltip": "String, default='deprecated'. The base estimator from which the ensemble is grown."
            },
            "learning_rate": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Weight applied to each classifier at each boosting iteration. A higher learning rate increases the contribution of each classifier. There is a trade-off between the learning_rate and n_estimators parameters. Values must be in the range (0.0, inf)."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Controls the random seed given at each estimator at each boosting iteration."
              },
            "loss": {
                "type": "list",
                "default_val": "linear",
                "tooltip": "<p>Loss function used when updating the weights after each boosting iteration. Default = <code>linear</code>.</p>\n<ul>\n<li><code>linear</code>: No change to the weights</li>\n<li><code>square</code>: Penalizes larger errors more strongly</li>\n<li><code>exponential</code>: Exponentially increases weight on wrong predictions</li>\n</ul>",
                "choices": {
                    "linear": "Linear (default)",
                    "square": "Square",
                    "exponential": "Exponential"
                }
            }
        },
        "code": "ada",
        "label": "AdaBoost Regressor"
    },
    "gbr": {
        "options": {
            "n_estimators": {
                "type": "int",
                "default_val": "100",
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "learning_rate": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. Weight applied to each classifier at each boosting iteration. A higher learning rate increases the contribution of each classifier. There is a trade-off between the learning_rate and n_estimators parameters. Values must be in the range (0.0, inf)."
            },
            "loss": {
                "type": "list",
                "default_val": "squared_error",
                "tooltip": "<p>Loss function to be optimized. Default = <code>squared_error</code>.</p>\n<ul>\n<li><code>squared_error</code>: Mean squared error regression loss</li>\n<li><code>absolute_error</code>: Mean absolute error regression loss</li>\n<li><code>huber</code>: Combination of squared error and absolute error</li>\n<li><code>quantile</code>: Used for quantile regression</li>\n</ul>",
                "choices": {
                    "squared_error": "Mean Squared Error (default)",
                    "absolute_error": "Mean Absolute Error",
                    "huber": "Huber Loss",
                    "quantile": "Quantile Loss"
                }
            },
            "criterion": {
                "type": "list",
                "default_val": "friedman_mse",
                "tooltip": "<p>Function to measure the quality of a split. Default = <code>friedman_mse</code>.</p>\n<ul>\n<li><code>friedman_mse</code>: Mean squared error with improvement score (default)</li>\n<li><code>squared_error</code>: Mean squared error</li>\n</ul>",
                "choices": {
                    "friedman_mse": "Friedman MSE (default)",
                    "squared_error": "Mean Squared Error"
                }
            },
            "min_samples_split": {
                "type": "int",
                "default_val": "2",
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": "1",
                "tooltip": "int, default=1. The minimum number of samples required to be at a leaf node. A split point at any depth will only be considered if it leaves at least min_samples_leaf training samples in each of the left and right branches. This may have the effect of smoothing the model, especially in regression."
            },
            "min_weight_fraction_leaf": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. The minimum weighted fraction of the sum total of weights (of all the input samples) required to be at a leaf node. Samples have equal weight when sample_weight is not provided."
            },
            "subsample": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. The fraction of samples to be used for fitting the individual base learners."
            },
            "max_features": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=”None”. The number of features to consider when looking for the best split: If int, then consider max_features features at each split. If float, then max_features is a fraction and max(1, int(max_features * n_features_in_)) features are considered at each split. If “sqrt”, then max_features=sqrt(n_features).If “log2”, then max_features=log2(n_features) If None, then max_features=n_features."
            },
            "max_depth": {
                "type": "int",
                "default_val": "3",
                "tooltip": "int, default=3. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "min_impurity_decrease": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. A node will be split if this split induces a decrease of the impurity greater than or equal to this value."
            },
            "ccp_alpha": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. Complexity parameter used for Minimal Cost-Complexity Pruning. The subtree with the largest cost complexity that is smaller than ccp_alpha will be chosen. By default, no pruning is performed."
            },
            "init": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None, An estimator object that is used to compute the initial predictions."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Controls the random seed given to each Tree estimator at each boosting iteration."
                        },
            "alpha": {
                "type": "float",
                "default_val": "0.9",
                "tooltip": "float, default=0.9. The alpha-quantile of the huber loss function and the quantile loss function."
            },
            "verbose": {
                "type": "int",
                "default_val": "0",
                "tooltip": "int, default=0. Enable verbose output."
            },
            "max_leaf_nodes": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Grow a tree with max_leaf_nodes in best-first fashion. Best nodes are defined as relative reduction in impurity. If None then unlimited number of leaf nodes."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "validation_fraction": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. The proportion of training data to set aside as validation set for early stopping. Must be between 0 and 1. Only used if early_stopping is True. Values must be in the range (0.0, 1.0)."
            },
            "n_iter_no_change": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Number of iterations with no improvement to wait before stopping fitting. Convergence is checked against the training loss or the validation loss depending on the early_stopping parameter. Integer values must be in the range [1, max_iter)."
            },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            }
        },
        "code": "gbr",
        "label": "Gradient Boosting Regressor"
    },
    "mlp": {
        "options": {
            "activation": {
                "type": "list",
                "default_val": "relu",
                "tooltip": "<p>Activation function for the hidden layer (used in the forward pass).</p>\n<ul>\n<li><code>identity</code>: f(x) = x</li>\n<li><code>logistic</code>: f(x) = 1 / (1 + exp(-x))</li>\n<li><code>tanh</code>: f(x) = tanh(x)</li>\n<li><code>relu</code>: f(x) = max(0, x)</li>\n</ul>",
                "choices": {
                    "identity": "Identity",
                    "logistic": "Logistic (sigmoid)",
                    "tanh": "Tanh",
                    "relu": "ReLU (default)"
                }
            },
            "solver": {
                "type": "list",
                "default_val": "adam",
                "tooltip": "<p>Solver for weight optimization.</p>\n<ul>\n<li><code>lbfgs</code>: Quasi-Newton optimizer (faster for small datasets)</li>\n<li><code>sgd</code>: Stochastic Gradient Descent</li>\n<li><code>adam</code>: Stochastic optimizer recommended for most tasks (default)</li>\n</ul>",
                "choices": {
                    "lbfgs": "LBFGS",
                    "sgd": "Stochastic Gradient Descent",
                    "adam": "Adam (default)"
                }
            },
            "alpha": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Constant that multiplies the penalty terms."
            },
            "batch_size": {
                "type": "string",
                "default_val": "auto",
				"tooltip": "String, default=’auto’. Size of minibatches for stochastic optimizers."
            },
            "learning_rate": {
                "type": "list",
                "default_val": "constant",
                "tooltip": "<p>Learning rate schedule for weight updates. Default = <code>constant</code>.</p>\n<ul>\n<li><code>constant</code>: eta = eta0</li>\n<li><code>invscaling</code>: eta = eta0 / pow(t, power_t)</li>\n<li><code>adaptive</code>: eta = eta0, reduced when validation score stops improving</li>\n</ul>",
                "choices": {
                    "constant": "Constant (default)",
                    "invscaling": "Inverse scaling",
                    "adaptive": "Adaptive"
                }
            },
            "learning_rate_init": {
                "type": "float",
                "default_val": "0.001",
                "tooltip": "float, default=0.001. The initial learning rate used. It controls the step-size in updating the weights."
            },
            "power_t": {
                "type": "float",
                "default_val": "0.5",
                "tooltip": "float, default=0.5. The exponent for inverse scaling learning rate. Values must be in the range (-inf, inf)."
            },
            "max_iter": {
                "type": "int",
                "default_val": "500",
                "tooltip": "int, default=500. The maximum number of iterations to be run."
            },
            "loss": {
                "type": "list",
                "default_val": "squared_error",
                "tooltip": "<p>Loss function used to optimize the network. Only <code>squared_error</code> is currently supported.</p>",
                "choices": {
                    "squared_error": "Squared error (default)"
                }
            },
            "hidden_layer_sizes": {
                "type": "tuple",
                "default_val": "(100,)",
                "tooltip": "tuple, default=(100,). The ith element represents the number of neurons in the ith hidden layer."
            },
            "shuffle": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. Whether or not the training data should be shuffled after each epoch."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Determines random number generation for weights and bias initialization"           
                },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            },
            "verbose": {
                "type": "bool",
                "default_val": "False",
				"tooltip": "bool, default=False. Whether to print progress messages to stdout."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "momentum": {
                "type": "float",
                "default_val": "0.9",
                "tooltip": "float, default=0.9. Momentum for gradient descent update. Should be between 0 and 1."
            },
            "nesterovs_momentum": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. Whether to use Nesterov’s momentum."
            },
            "early_stopping": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default='False'. Use early stopping to stop fitting to a hyperparameter configuration if it performs poorly. Ignored when search_library is scikit-learn, or if the estimator does not have ‘partial_fit’ attribute. If False or None, early stopping will not be used. "
            },
            "validation_fraction": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. The proportion of training data to set aside as validation set for early stopping. Must be between 0 and 1. Only used if early_stopping is True. Values must be in the range (0.0, 1.0)."
            },
            "beta_1": {
                "type": "float",
                "default_val": "0.9",
                "tooltip": "float, default=0.9. Exponential decay rate for estimates of first moment vector in adam, should be in [0, 1)."
            },
            "beta_2": {
                "type": "float",
                "default_val": "0.999",
                "tooltip": "float, default=0.999. Exponential decay rate for estimates of second moment vector in adam, should be in [0, 1)."
            },
            "epsilon": {
                "type": "float",
                "default_val": "1e-08",
                "tooltip": "float, default=1e-08. Epsilon in the epsilon-insensitive loss functions; only if loss is ‘huber’, ‘epsilon_insensitive’, or ‘squared_epsilon_insensitive’. For ‘huber’, determines the threshold at which it becomes less important to get the prediction exactly right. For epsilon-insensitive, any differences between the current prediction and the correct label are ignored if they are less than this threshold. Values must be in the range [0.0, inf)"
            },
            "n_iter_no_change": {
                "type": "int",
                "default_val": "10",
                "tooltip": "int, default=10. Number of iterations with no improvement to wait before stopping fitting. Convergence is checked against the training loss or the validation loss depending on the early_stopping parameter. Integer values must be in the range [1, max_iter)."
            },
            "max_fun": {
                "type": "int",
                "default_val": "15000",
                "tooltip": "int, default=15000. Only used when solver=’lbfgs’. Maximum number of loss function calls."
            }
        },
        "code": "mlp",
        "label": "Multi-layer Perceptron Regressor"
    },
    "lightgbm": {
        "options": {
            "boosting_type": {
                "type": "list",
                "default_val": "gbdt",
                "tooltip": "<p>Boosting method for training the LightGBM regressor. Default = <code>gbdt</code>.</p>\n<ul>\n<li><code>gbdt</code>: Traditional Gradient Boosting Decision Tree</li>\n<li><code>dart</code>: DART (Dropouts meet Additive Regression Trees)</li>\n<li><code>goss</code>: Gradient-based One-Side Sampling</li>\n<li><code>rf</code>: Random Forest</li>\n</ul>",
                "choices": {
                    "gbdt": "Gradient Boosting Decision Tree (default)",
                    "dart": "DART",
                    "goss": "GOSS",
                    "rf": "Random Forest"
                }
            },
            "objective": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Specify the learning task and the corresponding learning objective or a custom objective function to be used "
            },
            "num_leaves": {
                "type": "int",
                "default_val": "31",
                "tooltip": "int, default=31. Maximum tree leaves for base learners."
            },
            "max_depth": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "learning_rate": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. Weight applied to each classifier at each boosting iteration. A higher learning rate increases the contribution of each classifier. There is a trade-off between the learning_rate and n_estimators parameters. Values must be in the range (0.0, inf)."
            },
            "n_estimators": {
                "type": "int",
                "default_val": "100",
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "subsample_for_bin": {
                "type": "int",
                "default_val": "200000",
                "tooltip": "int, default=200000.  Number of samples for constructing bins."
            },
            "min_split_gain": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": " float, default=0. Minimum loss reduction required to make a further partition on a leaf node of the tree."
            },
            "min_child_weight": {
                "type": "float",
                "default_val": "0.001",
                "tooltip": "float, default=0.001. Minimum sum of instance weight (Hessian) needed in a child (leaf)."
            },
            "min_child_samples": {
                "type": "int",
                "default_val": "20",
                "tooltip": "int, default=20. Minimum number of data needed in a child (leaf)."
            },
            "subsample": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. The fraction of samples to be used for fitting the individual base learners."
            },
            "subsample_freq": {
                "type": "int",
                "default_val": "0",
                "tooltip": "int, default=0. Frequency of subsample, <=0 means no enable."
            },
            "colsample_bytree": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1. Subsample ratio of columns when constructing each tree."
            },
            "reg_alpha": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0. L1 regularization term on weights."
            },
            "reg_lambda": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0. L2 regularization term on weights."
            },
            "random_state": {
                "type": "int",
                "default_val": "8771",
                "tooltip": "int, default=8771. Random number seed. If int, this number is used to seed the C++ code. "  
                  },
            "n_jobs": {
                "type": "int",
                "default_val": "-1",
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "importance_type": {
                "type": "string",
                "default_val": "split",
                "tooltip": "String, default='split'. The type of feature importance to be filled into feature_importances_."
            },
            "class_weight": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Set the parameter C of class i to class_weight[i]*C for SVC. If not given, all classes are supposed to have weight one. The “balanced” mode uses the values of y to automatically adjust weights inversely proportional to class frequencies in the input data as n_samples / (n_classes * np.bincount(y))."
            }
        },
        "code": "lightgbm",
        "label": "LightGBM Regressor"
    },
    "dummy": {
        "options": {
            "strategy": {
                "type": "list",
                "default_val": "mean",
                "tooltip": "<p>Strategy to generate predictions. Default = <code>mean</code>.</p>\n<ul>\n<li><code>mean</code>: Always predicts the mean of the training targets</li>\n<li><code>median</code>: Predicts the median of the training targets</li>\n<li><code>quantile</code>: Predicts a specified quantile of the training targets</li>\n<li><code>constant</code>: Always predicts a constant value provided by the user</li>\n</ul>",
                "choices": {
                    "mean": "Mean (default)",
                    "median": "Median",
                    "quantile": "Quantile",
                    "constant": "Constant"
                }
            },
            "constant": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The explicit constant as predicted by the “constant” strategy. This parameter is useful only for the “constant” strategy."
            },
            "quantile": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The quantile to predict using the “quantile” strategy."
            }
        },
        "code": "dummy",
        "label": "Dummy Regressor"
    }
};
 export default regressionModelSettings;
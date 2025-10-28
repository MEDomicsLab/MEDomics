/* eslint-disable */
const classificationModelSettings = {
    "lr": {
        "options": {
            "penalty": {
                "type": "string",
                "default_val": "l2",
                "tooltip": "{‘l1’, ‘l2’}, default=’l2’ Specifies the norm used in the penalization. The ‘l2’ penalty is the standard used in SVC. The ‘l1’ leads to coef_ vectors that are sparse."
            },
            "dual": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=”false” Select the algorithm to either solve the dual or primal optimization problem. Prefer dual=False when n_samples > n_features."
            },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            },
            "C": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. Regularization parameter. The strength of the regularization is inversely proportional to C. Must be strictly positive."
            },
            "fit_intercept": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "Bool. default=True. Whether to calculate the intercept for this model. If set to False, no intercept will be used in calculations (i.e. data is expected to be centered)."
            },
            "intercept_scaling": {
                "type": "int",
                "default_val": 1,
                "tooltip": "int, default=1. When fit_intercept is True, the instance vector x becomes [x_1, ..., x_n, intercept_scaling], i.e. a “synthetic” feature with a constant value equal to intercept_scaling is appended to the instance vector. The intercept becomes intercept_scaling * synthetic feature weight. Note that liblinear internally penalizes the intercept, treating it like any other term in the feature vector. To reduce the impact of the regularization on the intercept, the intercept_scaling parameter can be set to a value greater than 1; the higher the value of intercept_scaling, the lower the impact of regularization on it. Then, the weights become [w_x_1, ..., w_x_n, w_intercept*intercept_scaling], where w_x_1, ..., w_x_n represent the feature weights and the intercept weight is scaled by intercept_scaling. This scaling allows the intercept term to have a different regularization behavior compared to the other features."
            },
            "class_weight": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Set the parameter C of class i to class_weight[i]*C for SVC. If not given, all classes are supposed to have weight one. The “balanced” mode uses the values of y to automatically adjust weights inversely proportional to class frequencies in the input data as n_samples / (n_classes * np.bincount(y))."
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=None. Used when solver == ‘sag’, ‘saga’ or ‘liblinear’ to shuffle the data."          
              },
            "solver": {
                "type": "string",
                "default_val": "lbfgs",
                "tooltip": "string, default=’lbfgs’. Algorithm to use in the optimization problem."
            },
            "max_iter": {
                "type": "int",
                "default_val": 1000,
                "tooltip": "int, default=1000. The maximum number of iterations to be run."
            },
            "multi_class": {
                "type": "string",
                "default_val": "auto",
                "tooltip": "String, default='auto' Determines the multi-class strategy if y contains more than two classes."
            },
            "verbose": {
                "type": "int",
                "default_val": 0,
                "tooltip": "int, default=0. For the liblinear and lbfgs solvers set verbose to any positive number for verbosity."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "n_jobs": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "l1_ratio": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default='None'. The ElasticNet mixing parameter, with 0 <= l1_ratio <= 1. For l1_ratio = 0 the penalty is an L2 penalty. For l1_ratio = 1 it is an L1 penalty. For 0 < l1_ratio < 1, the penalty is a combination of L1 and L2."
            }
        },
        "code": "lr",
        "label": "Logistic Regression"
    },
    "knn": {
        "options": {
            "n_neighbors": {
                "type": "int",
                "default_val": 5,
                "tooltip": "int, default=5. Number of neighboring samples to use for imputation."
            },
            "radius": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Limiting distance of neighbors to return. If radius is a float, then n_neighbors must be set to None."
            },
            "algorithm": {
                "type": "string",
                "default_val": "auto",
                "tooltip": "String, default=’auto’. Algorithm used to compute the nearest neighbors:‘ball_tree’ will use BallTree.‘kd_tree’ will use KDTree.‘brute’ will use a brute-force search.‘auto’ will attempt to decide the most appropriate algorithm based on the values passed to fit method. (default)"
            },
            "leaf_size": {
                "type": "int",
                "default_val": 30,
                "tooltip": "int, default=30. Leaf size passed to BallTree or KDTree. This can affect the speed of the construction and query, as well as the memory required to store the tree. The optimal value depends on the nature of the problem."
            },
            "metric": {
                "type": "string",
                "default_val": "minkowski",
                "tooltip": "String, default=’minkowski’. Distance metric for searching neighbors."
            },
            "metric_params": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Additional keyword arguments for the metric function."
            },
            "p": {
                "type": "int",
                "default_val": 2,
                "tooltip": "float, default=2. Parameter for the Minkowski metric from pairwise_distances. When p = 1, this is equivalent to using manhattan_distance (l1), and euclidean_distance (l2) for p = 2. For arbitrary p, minkowski_distance (l_p) is used."
            },
            "n_jobs": {
                "type": "int",
                "default_val": -1,
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "weights": {
                "type": "string",
                "default_val": "uniform",
                "tooltip": "String, default=’uniform’. Weight function used in prediction. Possible values: ‘uniform’ : Uniform weights. All points in each neighborhood are weighted equally. ‘Distance’ : weight points by the inverse of their distance. in this case, closer neighbors of a query point will have a greater influence than neighbors which are further away. Callable : a user-defined function which accepts an array of distances, and returns an array of the same shape containing the weights."
            }
        },
        "code": "knn",
        "label": "K-Nearest Neighbors"
    },
    "nb": {
        "options": {
            "priors": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Prior probabilities of the classes. If specified, the priors are not adjusted according to the data."
            },
            "var_smoothing": {
                "type": "float",
                "default_val": "1e-09",
                "tooltip": "float, default=1e-09. Portion of the largest variance of all features that is added to variances for calculation stability."
            }
        },
        "code": "nb",
        "label": "Naive Bayes"
    },
    "dt": {
        "options": {
            "criterion": {
                "type": "string",
                "default_val": "gini",
                "tooltip": "String, default=”gini”. The function to measure the quality of a split. Supported criteria are “gini” for the Gini impurity and “log_loss” and “entropy” both for the Shannon information gain"
            },
            "splitter": {
                "type": "string",
                "default_val": "best",
                "tooltip": "String, default=”best”. The strategy used to choose the split at each node. Supported strategies are “best” to choose the best split and “random” to choose the best random split."
            },
            "max_depth": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "min_samples_split": {
                "type": "int",
                "default_val": 2,
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": 1,
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
                "default_val": 1334,
                "tooltip": "int, default=1334. Controls the randomness of the estimator."
            },
            "min_impurity_decrease": {
                "type": "float",
                "default_val": 0.0,
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
        "label": "Decision Tree"
    },
    "svm": {
        "options": {
            "loss": {
                "type": "string",
                "default_val": "hinge",
                "tooltip": "String, default=’hinge’. The loss function to be used. ‘Hinge’ gives a linear SVM. ‘Log_loss’ gives logistic regression, a probabilistic classifier. ‘Modified_huber’ is another smooth loss that brings tolerance to outliers as well as probability estimates. ‘Squared_hinge’ is like hinge but is quadratically penalized. ‘Perceptron’ is the linear loss used by the perceptron algorithm. The other losses, ‘Squared_error’, ‘Huber’, ‘Epsilon_insensitive’ and ‘Squared_epsilon_insensitive’ are designed for regression but can be useful in classification as well"
            },
            "penalty": {
                "type": "string",
                "default_val": "l2",
                "tooltip": "{‘l1’, ‘l2’}, default=’l2’ Specifies the norm used in the penalization. The ‘l2’ penalty is the standard used in SVC. The ‘l1’ leads to coef_ vectors that are sparse."
            },
            "learning_rate": {
                "type": "string",
                "default_val": "optimal",
                "tooltip": "String, default=’optimal’. The learning rate schedule:‘constant’: eta = eta0‘ Pptimal’: eta = 1.0 / (alpha * (t + t0)) where t0 is chosen by a heuristic proposed by Leon Bottou. ‘Invscaling’: eta = eta0 / pow(t, power_t) ‘Adaptive’: eta = eta0, as long as the training keeps decreasing. Each time n_iter_no_change consecutive epochs fail to decrease the training loss by tol or fail to increase validation score by tol if early_stopping is True, the current learning rate is divided by 5."
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
                "type": "float",
                "default_val": "0.15",
                "tooltip": "float, default=0.15. The ElasticNet mixing parameter, with 0 <= l1_ratio <= 1. For l1_ratio = 0 the penalty is an L2 penalty. For l1_ratio = 1 it is an L1 penalty. For 0 < l1_ratio < 1, the penalty is a combination of L1 and L2."
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
                "default_val": 1334,
                "tooltip": "int, default=1334. The seed of the pseudo random number generator to use when shuffling the data."
            },
            "verbose": {
                "type": "int",
                "default_val": 0,
                "tooltip": "int, default=0. The verbosity level."
            },
            "eta0": {
                "type": "float",
                "default_val": 0.001,
				"tooltip": "float, default=0.001. The initial learning rate for the ‘constant’, ‘invscaling’ or ‘adaptive’ schedules. The default value is 0.0 as eta0 is not used by the default schedule ‘optimal’. Values must be in the range [0.0, inf)."
            },
            "power_t": {
                "type": "float",
                "default_val": 0.5,
                "tooltip": "float, default=0.5. The exponent for inverse scaling learning rate. Values must be in the range (-inf, inf)."
            },
            "early_stopping": {
                "type": "bool",
                "default_val": false,
                "tooltip": "bool, default='False'. Use early stopping to stop fitting to a hyperparameter configuration if it performs poorly. Ignored when search_library is scikit-learn, or if the estimator does not have ‘partial_fit’ attribute. If False or None, early stopping will not be used. "
            },
            "validation_fraction": {
                "type": "float",
                "default_val": 0.1,
                "max": "1.0",
                "min": "0.0",
                "tooltip": "float, default=0.1. The proportion of training data to set aside as validation set for early stopping. Must be between 0 and 1. Only used if early_stopping is True. Values must be in the range (0.0, 1.0)."
            },
            "n_iter_no_change": {
                "type": "int",
                "default_val": 5,
                "tooltip": "int, default=5. Number of iterations with no improvement to wait before stopping fitting. Convergence is checked against the training loss or the validation loss depending on the early_stopping parameter. Integer values must be in the range [1, max_iter)."
            },
            "warm_start": {
                "type": "bool",
                "default_val": false,
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "average": {
                "type": "bool",
                "default_val": "False",
				"tooltip": "bool, default=False. When set to True, computes the averaged SGD weights across all updates and stores the result in the coef_ attribute."
            },
            "max_iter": {
                "type": "int",
                "default_val": 1000,
                "tooltip": "int, default=1000. The maximum number of iterations to be run."
            },
            "tol": {
                "type": "float",
                "default_val": 0.001,
                "tooltip": "float, default=0.001. Tolerance for stopping criteria."
            },
            "class_weight": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Set the parameter C of class i to class_weight[i]*C for SVC. If not given, all classes are supposed to have weight one. The “balanced” mode uses the values of y to automatically adjust weights inversely proportional to class frequencies in the input data as n_samples / (n_classes * np.bincount(y))."
            },
            "n_jobs": {
                "type": "int",
                "default_val": -1,
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            }
        },
        "code": "svm",
        "label": "Support Vector Machine"
    },
    "rbfsvm": {
        "options": {
            "decision_function_shape": {
                "type": "string",
                "default_val": "ovr",
                "tooltip": "String, default=’ovr’. Whether to return a one-vs-rest (‘ovr’) decision function of shape (n_samples, n_classes) as all other classifiers, or the original one-vs-one (‘ovo’) decision function of libsvm which has shape (n_samples, n_classes * (n_classes - 1) / 2). "
            },
            "break_ties": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. If true, decision_function_shape='ovr', and number of classes > 2, predict will break ties according to the confidence values of decision_function; otherwise the first class among the tied classes is returned. "
            },
            "kernel": {
                "type": "string",
                "default_val": "rbf",
                "tooltip": "String, default=’rbf’, Specifies the kernel type to be used in the algorithm."
            },
            "degree": {
                "type": "int",
                "default_val": 3,
				"tooltip": "int, default=3. Degree of the polynomial kernel function (‘poly’). Must be non-negative. Ignored by all other kernels."
            },
            "gamma": {
                "type": "string",
                "default_val": "auto",
                "tooltip": "String, default=’auto’. Kernel coefficient for ‘rbf’, ‘poly’ and ‘sigmoid’."
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
                "default_val": "0.0",
                "tooltip": "float, default=0.0. Epsilon in the epsilon-insensitive loss functions; only if loss is ‘huber’, ‘epsilon_insensitive’, or ‘squared_epsilon_insensitive’. For ‘huber’, determines the threshold at which it becomes less important to get the prediction exactly right. For epsilon-insensitive, any differences between the current prediction and the correct label are ignored if they are less than this threshold. Values must be in the range [0.0, inf)"
            },
            "shrinking": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. Whether to use the shrinking heuristic."
            },
            "probability": {
                "type": "bool",
                "default_val": "True",
                "tooltip": "bool, default=True. Whether to enable probability estimates."
            },
            "cache_size": {
                "type": "int",
                "default_val": 200,
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
                "default_val": -1,
                "tooltip": "int, default=-1. The maximum number of iterations to be run."
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=1334. Controls the pseudo random number generation for shuffling the data for probability estimates."
                        }
        },
        "code": "rbfsvm",
        "label": "RBF Kernel-SVM"
    },
    "gpc": {
        "options": {
            "kernel": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=’None’, Specifies the kernel type to be used in the algorithm."
            },
            "optimizer": {
                "type": "string",
                "default_val": "fmin_l_bfgs_b",
                "tooltip": "String, default=’fmin_l_bfgs_b’. Can either be one of the internally supported optimizers for optimizing the kernel’s parameters, specified by a string, or an externally defined optimizer passed as a callable."
            },
            "n_restarts_optimizer": {
                "type": "int",
                "default_val": 0,
                "tooltip": "int, default=0. The number of restarts of the optimizer for finding the kernel’s parameters which maximize the log-marginal likelihood."
            },
            "max_iter_predict": {
                "type": "int",
                "default_val": 100,
                "tooltip": "int, default=100. he maximum number of iterations in Newton’s method for approximating the posterior during predict."
            },
            "warm_start": {
                "type": "bool",
                "default_val": false,
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "copy_X_train": {
                "type": "bool",
                "default_val": false,
                "tooltip": "bool, default=False. If True, a persistent copy of the training data is stored in the object. Otherwise, just a reference to the training data is stored, which might cause predictions to change if the data is modified externally."
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=1334. Determines random number generation used to initialize the centers. Pass an int for reproducible results across multiple function calls. "          
              },
            "multi_class": {
                "type": "string",
                "default_val": "one_vs_rest",
                "tooltip": "String, default='one_vs_rest'. Determines the multi-class strategy if y contains more than two classes."
            },
            "n_jobs": {
                "type": "int",
                "default_val": -1,
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            }
        },
        "code": "gpc",
        "label": "Gaussian Process Classifier"
    },
    "mlp": {
        "options": {
            "activation": {
                "type": "string",
                "default_val": "relu",
                "tooltip": "String, default=’relu’. Activation function for the hidden layer."
            },
            "solver": {
                "type": "string",
                "default_val": "adam",
                "tooltip": "String, default=’adam’. Algorithm to use in the optimization problem."
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
                "type": "string",
                "default_val": "constant",
                "tooltip": "String, default=’constant’. The learning rate schedule:‘constant’: eta = eta0‘ Pptimal’: eta = 1.0 / (alpha * (t + t0)) where t0 is chosen by a heuristic proposed by Leon Bottou. ‘Invscaling’: eta = eta0 / pow(t, power_t) ‘Adaptive’: eta = eta0, as long as the training keeps decreasing. Each time n_iter_no_change consecutive epochs fail to decrease the training loss by tol or fail to increase validation score by tol if early_stopping is True, the current learning rate is divided by 5."
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
                "default_val": 500,
                "tooltip": "int, default=500. The maximum number of iterations to be run."
            },
            "loss": {
                "type": "string",
                "default_val": "log_loss",
                "tooltip": "String, default=’log_loss’. The loss function to be used. ‘Hinge’ gives a linear SVM. ‘Log_loss’ gives logistic regression, a probabilistic classifier. ‘Modified_huber’ is another smooth loss that brings tolerance to outliers as well as probability estimates. ‘Squared_hinge’ is like hinge but is quadratically penalized. ‘Perceptron’ is the linear loss used by the perceptron algorithm. The other losses, ‘Squared_error’, ‘Huber’, ‘Epsilon_insensitive’ and ‘Squared_epsilon_insensitive’ are designed for regression but can be useful in classification as well"
            },
            "hidden_layer_sizes": {
                "type": "tuple",
                "default_val": "(100,)",
                "tooltip": "tuple, default=(100,). The ith element represents the number of neurons in the ith hidden layer."
            },
            "shuffle": {
                "type": "bool",
                "default_val": true,
                "tooltip": "bool, default=True. Whether or not the training data should be shuffled after each epoch."
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=1334. Determines random number generation for weights and bias initialization"
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
                "max": "1.0",
                "min": "0.0",
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
                "default_val": 10,
                "tooltip": "int, default=10. Number of iterations with no improvement to wait before stopping fitting. Convergence is checked against the training loss or the validation loss depending on the early_stopping parameter. Integer values must be in the range [1, max_iter)."
            },
            "max_fun": {
                "type": "int",
                "default_val": 15000,
                "tooltip": "int, default=15000. Only used when solver=’lbfgs’. Maximum number of loss function calls."
            }
        },
        "code": "mlp",
        "label": "Multi-Layer Perceptron"
    },
    "rf": {
        "options": {
            "n_estimators": {
                "type": "int",
                "default_val": 100,
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
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
                "default_val": -1,
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=1334. Controls the random resampling of the original dataset (sample wise and feature wise). "          
              },
            "verbose": {
                "type": "int",
                "default_val": 0,
                "tooltip": "int, default=0. Controls the verbosity when fitting and predicting."
            },
            "warm_start": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. When set to True, reuse the solution of the previous call to fit as initialization, otherwise, just erase the previous solution."
            },
            "class_weight": {
                "type": "string",
                "default_val": "None",
                "choices": ["None", "balanced", "balanced_subsample"],
                "tooltip": "class_weight ∈ {'balanced','balanced_subsample'}, default=None. 'balanced' uses class frequencies (n_samples / (n_classes * np.bincount(y))) to set weights. 'balanced_subsample' is the same but computed on each tree's bootstrap sample. If sample_weight is passed to fit(), it is multiplied with class_weight. Use None to disable class weighting."
            },
            "max_samples": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The number of samples to draw from X to train each base estimator "
            },
            "criterion": {
                "type": "string",
                "default_val": "gini",
                "tooltip": "String, default=”gini”. The function to measure the quality of a split. Supported criteria are “gini” for the Gini impurity and “log_loss” and “entropy” both for the Shannon information gain"
            },
            "max_depth": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "min_samples_split": {
                "type": "int",
                "default_val": 2,
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": 1,
                "tooltip": "int, default=1. The minimum number of samples required to be at a leaf node. A split point at any depth will only be considered if it leaves at least min_samples_leaf training samples in each of the left and right branches. This may have the effect of smoothing the model, especially in regression."
            },
            "min_weight_fraction_leaf": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. The minimum weighted fraction of the sum total of weights (of all the input samples) required to be at a leaf node. Samples have equal weight when sample_weight is not provided."
            },
            "max_features": {
                "type": "string",
                "default_val": "sqrt",
                "tooltip": "String, default=”sqrt”. The number of features to consider when looking for the best split: If int, then consider max_features features at each split. If float, then max_features is a fraction and max(1, int(max_features * n_features_in_)) features are considered at each split. If “sqrt”, then max_features=sqrt(n_features).If “log2”, then max_features=log2(n_features) If None, then max_features=n_features."
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
        "label": "Random Forest"
    },
    "qda": {
        "options": {
            "priors": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Class priors. By default, the class proportions are inferred from the training data."
            },
            "reg_param": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. Regularizes the per-class covariance estimates by transforming S2 as S2 = (1 - reg_param) * S2 + reg_param * np.eye(n_features), where S2 corresponds to the scaling_ attribute of a given class."
            },
            "store_covariance": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. If True, the class covariance matrices are explicitly computed and stored in the self.covariance_ attribute."
            },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            }
        },
        "code": "qda",
        "label": "Quadratic Discriminant Analysis"
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
                "default_val": 50,
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
                "default_val": 1334,
                "tooltip": "int, default=1334. Controls the random seed given at each estimator at each boosting iteration."
                        },
            "algorithm": {
                "type": "string",
                "default_val": "SAMME.R",
                "tooltip": "String, default=’SAMME.R’. If ‘SAMME.R’ then use the SAMME.R real boosting algorithm. estimator must support calculation of class probabilities. If ‘SAMME’ then use the SAMME discrete boosting algorithm. The SAMME.R algorithm typically converges faster than SAMME, achieving a lower test error with fewer boosting iterations."
            }
        },
        "code": "ada",
        "label": "AdaBoost"
    },
    "gbc": {
        "options": {
            "n_estimators": {
                "type": "int",
                "default_val": 100,
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "learning_rate": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. Weight applied to each classifier at each boosting iteration. A higher learning rate increases the contribution of each classifier. There is a trade-off between the learning_rate and n_estimators parameters. Values must be in the range (0.0, inf)."
            },
            "loss": {
                "type": "string",
                "default_val": "log_loss",
                "tooltip": "String, default=’log_loss’. The loss function to be used. ‘Hinge’ gives a linear SVM. ‘Log_loss’ gives logistic regression, a probabilistic classifier. ‘Modified_huber’ is another smooth loss that brings tolerance to outliers as well as probability estimates. ‘Squared_hinge’ is like hinge but is quadratically penalized. ‘Perceptron’ is the linear loss used by the perceptron algorithm. The other losses, ‘Squared_error’, ‘Huber’, ‘Epsilon_insensitive’ and ‘Squared_epsilon_insensitive’ are designed for regression but can be useful in classification as well"
            },
            "criterion": {
                "type": "string",
                "default_val": "friedman_mse",
                "tooltip": "String, default=”friedman_mse”. The function to measure the quality of a split. Supported criteria are “gini” for the Gini impurity and “log_loss” and “entropy” both for the Shannon information gain"
            },
            "min_samples_split": {
                "type": "int",
                "default_val": 2,
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": 1,
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
                "default_val": 3,
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
                "tooltip": "NoneType, default=None. An estimator object that is used to compute the initial predictions. "
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=1334. Controls the random seed given to each Tree estimator at each boosting iteration. "           
             },
            "alpha": {
                "type": "float",
                "default_val": "0.9",
                "tooltip": "float, default=0.9. Constant that multiplies the penalty terms."
            },
            "verbose": {
                "type": "int",
                "default_val": 0,
                "tooltip": "int, default=0. Enable verbose output. If 1 then it prints progress and performance once in a while (the more trees the lower the frequency)"
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
                "max": "1.0",
                "min": "0.0",
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
        "code": "gbc",
        "label": "Gradient Boosting Classifier"
    },
    "xgboost": {
  "options": {
    "n_estimators": {
      "type": "int",
      "default_val": 100,
      "tooltip": "int, default=100. Number of boosting rounds (trees)."
    },
    "learning_rate": {
      "type": "float",
      "default_val": "0.1",
      "tooltip": "float, default=0.1. Step size shrinkage used in update to prevents overfitting."
    },
    "max_depth": {
      "type": "int",
      "default_val": 6,
      "tooltip": "int, default=6. Maximum tree depth for base learners."
    },
    "min_child_weight": {
      "type": "float",
      "default_val": "1.0",
      "tooltip": "float, default=1. Minimum sum of instance weight (hessian) needed in a child."
    },
    "gamma": {
      "type": "float",
      "default_val": "0.0",
      "tooltip": "float, default=0. Minimum loss reduction required to make a further partition on a leaf node."
    },
    "subsample": {
      "type": "float",
      "default_val": "1.0",
      "tooltip": "float, default=1.0. Subsample ratio of the training instances."
    },
    "colsample_bytree": {
      "type": "float",
      "default_val": "1.0",
      "tooltip": "float, default=1.0. Subsample ratio of columns when constructing each tree."
    },
    "colsample_bylevel": {
      "type": "float",
      "default_val": "1.0",
      "tooltip": "float, default=1.0. Subsample ratio of columns for each tree level."
    },
    "colsample_bynode": {
      "type": "float",
      "default_val": "1.0",
      "tooltip": "float, default=1.0. Subsample ratio of columns for each split."
    },
    "reg_alpha": {
      "type": "float",
      "default_val": "0.0",
      "tooltip": "float, default=0. L1 regularization term on weights."
    },
    "reg_lambda": {
      "type": "float",
      "default_val": "1.0",
      "tooltip": "float, default=1. L2 regularization term on weights."
    },
    "scale_pos_weight": {
      "type": "float",
      "default_val": "1.0",
      "tooltip": "float, default=1. Control balance of positive/negative weights, useful for unbalanced classes."
    },
    "booster": {
      "type": "string",
      "default_val": "gbtree",
      "tooltip": "string, default='gbtree'. Booster to use: 'gbtree', 'gblinear', or 'dart'."
    },
    "tree_method": {
      "type": "string",
      "default_val": "auto",
      "tooltip": "string, default='auto'. Tree construction algorithm: 'auto', 'exact', 'approx', 'hist', 'gpu_hist' (si GPU dispo)."
    },
    "grow_policy": {
      "type": "string",
      "default_val": "depthwise",
      "tooltip": "string, default='depthwise'. Strategy to grow trees: 'depthwise' or 'lossguide'."
    },
    "random_state": {
      "type": "int",
      "default_val": 1334,
      "tooltip": "int, default=1334. Random seed."
    },
    "n_jobs": {
      "type": "int",
      "default_val": -1,
      "tooltip": "int, default=-1. Number of parallel threads."
    },
    "verbosity": {
      "type": "int",
      "default_val": 0,
      "tooltip": "int, default=0. Verbosity of printing messages (0=silent, 1=warning, 2=info, 3=debug)."
    }
  },
  "code": "xgboost",
  "label": "XGBoost"
},
    "lda": {
        "options": {
            "solver": {
                "type": "string",
                "default_val": "svd",
                "tooltip": "string, default=’svd’. Algorithm to use in the optimization problem."
            },
            "shrinkage": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None Shrinkage parameter, possible values: None: no shrinkage (default). ‘auto’: automatic shrinkage using the Ledoit-Wolf lemma. float between 0 and 1: fixed shrinkage parameter."
            },
            "priors": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The class prior probabilities. By default, the class proportions are inferred from the training data."
            },
            "n_components": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Number of components (<= min(n_classes - 1, n_features)) for dimensionality reduction."
            },
            "store_covariance": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. If True, the class covariance matrices are explicitly computed and stored in the self.covariance_ attribute."
            },
            "tol": {
                "type": "float",
                "default_val": "0.0001",
                "tooltip": "float, default=0.0001. Tolerance for stopping criteria."
            },
            "covariance_estimator": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. If not None, covariance_estimator is used to estimate the covariance matrices instead of relying on the empirical covariance estimator (with potential shrinkage). "
            }
        },
        "code": "lda",
        "label": "Linear Discriminant Analysis"
    },
    "et": {
        "options": {
            "estimator": {
                "type": "ExtraTreeClassifier",
                "default_val": "ExtraTreeClassifier(ccp_alpha=0.0, class_weight=None, criterion='gini',\n                    max_depth=None, max_features='sqrt', max_leaf_nodes=None,\n                    min_impurity_decrease=0.0, min_samples_leaf=1,\n                    min_samples_split=2, min_weight_fraction_leaf=0.0,\n                    random_state=None, splitter='random')",
                "tooltip": "Object, default='ExtraTreeClassifier'. The base estimator from which the boosted ensemble is built. Support for sample weighting is required, as well as proper classes_ and n_classes_ attributes. If None, then the base estimator is DecisionTreeClassifier initialized with max_depth=1."
            },
            "n_estimators": {
                "type": "int",
                "default_val": 100,
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
                "default_val": -1,
                "tooltip": "int, default=-1. Number of CPU cores used when parallelizing over classes if multi_class=’ovr’”. This parameter is ignored when the solver is set to ‘liblinear’ regardless of whether ‘multi_class’ is specified or not."
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=1334. Controls the random resampling of the original dataset (sample wise and feature wise). "          
                  },
            "verbose": {
                "type": "int",
                "default_val": 0,
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
                "default_val": "gini",
                "tooltip": "String, default=”gini”. The function to measure the quality of a split. Supported criteria are “gini” for the Gini impurity and “log_loss” and “entropy” both for the Shannon information gain"
            },
            "max_depth": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "min_samples_split": {
                "type": "int",
                "default_val": 2,
				"tooltip": "int, default=2. The minimum number of samples required to split an internal node:"
            },
            "min_samples_leaf": {
                "type": "int",
                "default_val": 1,
                "tooltip": "int, default=1. The minimum number of samples required to be at a leaf node. A split point at any depth will only be considered if it leaves at least min_samples_leaf training samples in each of the left and right branches. This may have the effect of smoothing the model, especially in regression."
            },
            "min_weight_fraction_leaf": {
                "type": "float",
                "default_val": "0.0",
                "tooltip": "float, default=0.0. The minimum weighted fraction of the sum total of weights (of all the input samples) required to be at a leaf node. Samples have equal weight when sample_weight is not provided."
            },
            "max_features": {
                "type": "string",
                "default_val": "sqrt",
                "tooltip": "String, default=”sqrt”. The number of features to consider when looking for the best split: If int, then consider max_features features at each split. If float, then max_features is a fraction and max(1, int(max_features * n_features_in_)) features are considered at each split. If “sqrt”, then max_features=sqrt(n_features).If “log2”, then max_features=log2(n_features) If None, then max_features=n_features."
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
        "label": "Extra Trees"
    },
    "lightgbm": {
        "options": {
            "boosting_type": {
                "type": "string",
                "default_val": "gbdt",
                "tooltip": "String, default='gbdt'. traditional Gradient Boosting Decision Tree."
            },
            "objective": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. Specify the learning task and the corresponding learning objective or a custom objective function to be used "
            },
            "num_leaves": {
                "type": "int",
                "default_val": 31,
                "tooltip": "int, default=31. Maximum tree leaves for base learners."
            },
            "max_depth": {
                "type": "int",
                "default_val": -1,
                "tooltip": "int, default=-1. The maximum depth of the tree. If None, then nodes are expanded until all leaves are pure or until all leaves contain less than min_samples_split samples."
            },
            "learning_rate": {
                "type": "float",
                "default_val": "0.1",
                "tooltip": "float, default=0.1. Weight applied to each classifier at each boosting iteration. A higher learning rate increases the contribution of each classifier. There is a trade-off between the learning_rate and n_estimators parameters. Values must be in the range (0.0, inf)."
            },
            "n_estimators": {
                "type": "int",
                "default_val": 100,
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "subsample_for_bin": {
                "type": "int",
                "default_val": 200000,
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
                "default_val": 20,
                "tooltip": "int, default=20. Minimum number of data needed in a child (leaf)."
            },
            "subsample": {
                "type": "float",
                "default_val": "1.0",
                "tooltip": "float, default=1.0. The fraction of samples to be used for fitting the individual base learners."
            },
            "subsample_freq": {
                "type": "int",
                "default_val": 0,
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
                "default_val": 1334,
                "tooltip": "int, default=1334. Random number seed. If int, this number is used to seed the C++ code. "  
                      },
            "n_jobs": {
                "type": "int",
                "default_val": -1,
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
        "label": "LightGBM"
    },
    "dummy": {
        "options": {
            "strategy": {
                "type": "string",
                "default_val": "prior",
                "tooltip": "String, default=”prior”. Strategy to use to generate predictions. “prior”: the predict method always returns the most frequent class label in the observed y argument passed to fit (like “most_frequent”)."
            },
            "random_state": {
                "type": "int",
                "default_val": 1334,
                "tooltip": "int, default=1334. Controls the randomness to generate the predictions when strategy='stratified' or strategy='uniform'. Pass an int for reproducible output across multiple function calls."
                        },
            "constant": {
                "type": "NoneType",
                "default_val": "None",
                "tooltip": "NoneType, default=None. The explicit constant as predicted by the “constant” strategy."
            }
        },
        "code": "dummy",
        "label": "Dummy Classifier"
    }
};
 export default classificationModelSettings;
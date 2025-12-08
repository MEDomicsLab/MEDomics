/* eslint-disable */
const classificationModelSettings = {
    "lr": {
        "options": {
            "penalty": {
                "type": "list",
                "default_val": "l2",
                "tooltip": "<p>Specifies the norm used in the penalization. The <code>l2</code> penalty is the standard used in SVC. The <code>l1</code> penalty leads to <code>coef_</code> vectors that are sparse.</p>\n<p>Options: <code>l1</code>, <code>l2</code>. Default = <code>l2</code>.</p>",
                "choices": {
                    "l1": "L1",
                    "l2": "L2"
                }
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
                "type": "list",
                "default_val": "lbfgs",
                "tooltip": "<p>Algorithm to use in the optimization problem. Default = <code>lbfgs</code>.</p>\n<ul>\n<li><b>newton-cg</b>: Newton Conjugate Gradient.</li>\n<li><b>lbfgs</b>: Limited-memory BFGS (default).</li>\n<li><b>liblinear</b>: Library for large linear classification.</li>\n</ul>",
                "choices": {
                    "newton-cg": "Newton-CG",
                    "lbfgs": "LBFGS",
                    "liblinear": "LibLinear"
                }
            },
            "max_iter": {
                "type": "int",
                "default_val": 1000,
                "tooltip": "int, default=1000. The maximum number of iterations to be run."
            },
            "multi_class": {
                "type": "list",
                "default_val": "auto",
                "tooltip": "<p>Determines the multi-class strategy when the target <code>y</code> has more than two classes. Default = <code>auto</code>.</p>\n<ul>\n<li><b>auto</b>: Automatically selects <code>ovr</code> or <code>multinomial</code> based on the solver. Uses <code>multinomial</code> if <code>solver='lbfgs'</code>.</li>\n<li><b>ovr</b>: One-vs-Rest — fits a binary problem for each class.</li>\n<li><b>multinomial</b>: Minimizes the multinomial loss over the entire probability distribution. Only supported by the <code>lbfgs</code> solver.</li>\n</ul>",
                "choices": {
                    "auto": "Auto",
                    "ovr": "OvR",
                    "multinomial": "Multinomial"
                }
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
                "type": "list",
                "default_val": "auto",
                "tooltip": "<p>Algorithm used to compute the nearest neighbors. Default = <code>auto</code>.</p>\n<ul>\n<li><b>auto</b>: Chooses the best algorithm based on the training data.</li>\n<li><b>ball_tree</b>: Uses BallTree algorithm.</li>\n<li><b>kd_tree</b>: Uses KDTree algorithm.</li>\n<li><b>brute</b>: Uses brute-force search.</li>\n</ul>\n<p><strong>Note:</strong> Fitting on sparse input will override this parameter and use brute force.</p>",
                "choices": {
                    "auto": "Auto",
                    "ball_tree": "Ball Tree",
                    "kd_tree": "KD Tree",
                    "brute": "Brute Force"
                }
            },
            "leaf_size": {
                "type": "int",
                "default_val": 30,
                "tooltip": "int, default=30. Leaf size passed to BallTree or KDTree. This can affect the speed of the construction and query, as well as the memory required to store the tree. The optimal value depends on the nature of the problem."
            },
            "metric": {
                "type": "list",
                "default_val": "minkowski",
                "tooltip": "<p>Distance metric to use for neighbor search. Default = <code>minkowski</code>, which is equivalent to Euclidean distance when <code>p=2</code>.</p>\n<ul>\n<li><b>minkowski</b>: Generalized distance (default).</li>\n<li><b>euclidean</b>: Euclidean distance (same as <code>minkowski</code> with <code>p=2</code>).</li>\n<li><b>manhattan</b>: Manhattan distance (same as <code>minkowski</code> with <code>p=1</code>).</li>\n<li><b>chebyshev</b>: Chebyshev distance.</li>\n<li><b>hamming</b>: Hamming distance.</li>\n<li><b>precomputed</b>: Use a precomputed distance matrix (X must be square).</li>\n</ul>\n<p>You may also provide a callable function, but it is less efficient.</p>",
                "choices": {
                    "minkowski": "Minkowski",
                    "euclidean": "Euclidean",
                    "manhattan": "Manhattan",
                    "chebyshev": "Chebyshev",
                    "hamming": "Hamming",
                }
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
            "type": "list",
            "default_val": "uniform",
            "tooltip": "<p>Weight function used in prediction. Default = <code>uniform</code>.</p>\n<ul>\n<li><b>uniform</b>: All points in each neighborhood are weighted equally.</li>\n<li><b>distance</b>: Weight points by the inverse of their distance (closer neighbors have more influence).</li>\n</ul>\n<p><b>Note :</b> You can also provide a callable (custom function), but this is not supported in the current UI.</p>",
            "choices": {
                "uniform": "Uniform",
                "distance": "Distance-based"
            }
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
            "type": "list",
            "default_val": "gini",
            "tooltip": "<p>Function to measure the quality of a split. Default = <code>gini</code>.</p>\n<ul>\n<li><b>gini</b>: Gini impurity.</li>\n<li><b>entropy</b>: Shannon information gain (entropy).</li>\n<li><b>log_loss</b>: Shannon information gain (log loss).</li>\n</ul>",
            "choices": {
                "gini": "Gini",
                "entropy": "Entropy",
                "log_loss": "Log Loss"
            }
            },
            "splitter": {
                "type": "list",
                "default_val": "best",
                "tooltip": "<p>Strategy used to choose the split at each node. Default = <code>best</code>.</p>\n<ul>\n<li><b>best</b>: Chooses the best possible split.</li>\n<li><b>random</b>: Chooses the best random split.</li>\n</ul>",
                "choices": {
                    "best": "Best",
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
            "type": "list",
            "default_val": "hinge",
            "tooltip": "<p>The loss function to be used. Default = <code>hinge</code>.</p>\n<ul>\n<li><b>hinge</b>: Linear SVM (default).</li>\n<li><b>log_loss</b>: Logistic regression (probabilistic classifier).</li>\n<li><b>modified_huber</b>: Smooth loss, robust to outliers, gives probabilities.</li>\n<li><b>squared_hinge</b>: Like hinge but penalized quadratically.</li>\n<li><b>perceptron</b>: Linear loss for the perceptron algorithm.</li>\n<li><b>squared_error</b>, <b>huber</b>, <b>epsilon_insensitive</b>, <b>squared_epsilon_insensitive</b>: Regression losses, can be useful in classification.</li>\n</ul>",
            "choices": {
                "hinge": "Hinge (SVM)",
                "log_loss": "Log Loss (Logistic Regression)",
                "modified_huber": "Modified Huber",
                "squared_hinge": "Squared Hinge",
                "perceptron": "Perceptron",
                "squared_error": "Squared Error",
                "huber": "Huber",
                "epsilon_insensitive": "Epsilon Insensitive",
                "squared_epsilon_insensitive": "Squared Epsilon Insensitive"
            }
            },
            "penalty": {
                "type": "list",
                "default_val": "l2",
                "tooltip": "<p>Specifies the norm used in the penalization. Default = <code>l2</code>.</p>\n<ul>\n<li><b>l1</b>: Produces sparse coefficient vectors.</li>\n<li><b>l2</b>: Standard used in SVC (default).</li>\n</ul>",
                "choices": {
                    "l1": "L1",
                    "l2": "L2"
                }
            },
            "learning_rate": {
                "type": "list",
                "default_val": "optimal",
                "tooltip": "<p>Learning rate schedule. Default = <code>optimal</code>.</p>\n<ul>\n<li><b>constant</b>: eta = eta0</li>\n<li><b>optimal</b>: eta = 1.0 / (alpha * (t + t0)), t0 heuristically chosen (default).</li>\n<li><b>invscaling</b>: eta = eta0 / pow(t, power_t)</li>\n<li><b>adaptive</b>: eta = eta0 as long as training improves, divided by 5 on plateau.</li>\n</ul>",
                "choices": {
                    "constant": "Constant",
                    "optimal": "Optimal",
                    "invscaling": "Inverse Scaling",
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
                "type": "list",
                "default_val": "ovr",
                "tooltip": "<p>Whether to return a one-vs-rest (<code>ovr</code>) decision function of shape <code>(n_samples, n_classes)</code> — as in most classifiers — or the original one-vs-one (<code>ovo</code>) decision function of <code>libsvm</code>, which has shape <code>(n_samples, n_classes × (n_classes - 1) / 2)</code>.</p><p>Default = <code>ovr</code>.</p>",
                "choices": {
                    "ovr": "OvR",
                    "ovo": "OvO"
            }
            },
            "break_ties": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "bool, default=False. If true, decision_function_shape='ovr', and number of classes > 2, predict will break ties according to the confidence values of decision_function; otherwise the first class among the tied classes is returned. "
            },
            "kernel": {
                "type": "list",
                "default_val": "rbf",
                "tooltip": "<p>Specifies the kernel type to be used in the algorithm. Default = <code>rbf</code>.</p>\n<ul>\n<li><b>linear</b>: Linear kernel.</li>\n<li><b>poly</b>: Polynomial kernel.</li>\n<li><b>rbf</b>: Radial Basis Function kernel (default).</li>\n<li><b>sigmoid</b>: Sigmoid kernel.</li>\n<li><b>precomputed</b>: Use a user-provided kernel matrix instead of computing it.</li>\n</ul>",
                "choices": {
                    "rbf": "RBF",
                    "linear": "Linear",
                    "poly": "Polynomial",
                    "sigmoid": "Sigmoid",
                    "precomputed": "Precomputed kernel matrix"
                }
            },
            "degree": {
                "type": "int",
                "default_val": 3,
				"tooltip": "int, default=3. Degree of the polynomial kernel function (‘poly’). Must be non-negative. Ignored by all other kernels."
            },
            "gamma": {
                "type": "list",
                "default_val": "auto",
                "tooltip": "<p>Kernel coefficient for <code>rbf</code>, <code>poly</code> and <code>sigmoid</code>. Determines how far the influence of a single training example reaches.</p>\n<ul>\n<li><b>auto</b>: Uses <code>1 / n_features</code>.</li>\n<li><b>scale</b>: Uses <code>1 / (n_features * X.var())</code>. More robust (recommended).</li>\n</ul>\n<p><strong>Note :</strong> You can also specify a float value manually via the backend if needed.</p>",
                "choices": {
                    "auto": "Auto",
                    "scale": "Scale"
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
                "type": "list",
                "default_val": "fmin_l_bfgs_b",
                "tooltip": "<p>Algorithm used to optimize the kernel’s parameters. Default = <code>fmin_l_bfgs_b</code>.</p>\n<ul>\n<li><b>fmin_l_bfgs_b</b>: Quasi-Newton method for bound-constrained optimization (default).</li>\n<li><b>None</b>: Disable optimization; use initial kernel parameters.</li>\n</ul>\n<p><strong>Note :</strong> Callables (custom functions) are supported in scikit-learn, but not in the current UI.</p>",
                "choices": {
                    "fmin_l_bfgs_b": "fmin_l_bfgs_b"
                    
                }
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
                "type": "list",
                "default_val": "one_vs_rest",
                "tooltip": "<p>Determines the multi-class strategy when the target <code>y</code> contains more than two classes. Only <code>one_vs_rest</code> is supported in <code>GaussianProcessClassifier</code>.</p>",
                "choices": {
                    "one_vs_rest": "One-vs-Rest"
                }
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
                "type": "list",
                "default_val": "relu",
                "tooltip": "<p>Activation function for the hidden layer. Default = <code>relu</code>.</p>\n<ul>\n<li><b>identity</b>: No-op activation, returns input as is.</li>\n<li><b>logistic</b>: Sigmoid function.</li>\n<li><b>tanh</b>: Hyperbolic tangent function.</li>\n<li><b>relu</b>: Rectified Linear Unit function (default).</li>\n</ul>",
                "choices": {
                    "identity": "Identity",
                    "logistic": "Logistic (Sigmoid)",
                    "tanh": "Tanh",
                    "relu": "ReLU (default)"
                }
            },
            "solver": {
                "type": "list",
                "default_val": "adam",
                "tooltip": "<p>Algorithm to use for weight optimization. Default = <code>adam</code>.</p>\n<ul>\n<li><b>lbfgs</b>: Optimizer in the family of quasi-Newton methods.</li>\n<li><b>sgd</b>: Stochastic Gradient Descent.</li>\n<li><b>adam</b>: Stochastic optimizer based on adaptive estimates of lower-order moments (default).</li>\n</ul>",
                "choices": {
                    "lbfgs": "L-BFGS",
                    "sgd": "SGD",
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
                "tooltip": "<p>Learning rate schedule for weight updates. Default = <code>constant</code>.</p>\n<ul>\n<li><b>constant</b>: eta = eta0 (default).</li>\n<li><b>invscaling</b>: eta = eta0 / pow(t, power_t).</li>\n<li><b>adaptive</b>: eta = eta0 as long as loss improves, else divided by 5.</li>\n</ul>",
                "choices": {
                    "constant": "Constant (default)",
                    "invscaling": "Invscaling",
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
                "default_val": 500,
                "tooltip": "int, default=500. The maximum number of iterations to be run."
            },
            "loss": {
                "type": "list",
                "default_val": "log_loss",
                "tooltip": "<p>Loss function to use (default: <code>log_loss</code>).</p>\n<p><strong>Classification:</strong> <code>hinge</code> (SVM), <code>log_loss</code> (logistic), <code>modified_huber</code>, <code>squared_hinge</code>, <code>perceptron</code>.</p>\n<p>Some regression losses like <code>squared_error</code> and <code>huber</code> can also be used for classification. </p>",
                "choices": {
                    "hinge": "Hinge (classification)",
                    "log_loss": "Log Loss (classification, default)",
                    "modified_huber": "Modified Huber (classification)",
                    "squared_hinge": "Squared Hinge (classification)",
                    "perceptron": "Perceptron (classification)",
                    "squared_error": "Squared Error (regression-style)",
                    "huber": "Huber (regression-style)",
                    "epsilon_insensitive": "Epsilon Insensitive (regression-style)",
                    "squared_epsilon_insensitive": "Squared Epsilon Insensitive (regression-style)"
                }
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
            "estimator": {
                "type": "DecisionTreeClassifier",
                "default_val": "DecisionTreeClassifier(ccp_alpha=0.0, class_weight=None, criterion='gini',\n                       max_depth=None, max_features=None, max_leaf_nodes=None,\n                       min_impurity_decrease=0.0, min_samples_leaf=1,\n                       min_samples_split=2, min_weight_fraction_leaf=0.0,\n                       random_state=None, splitter='best')",
                "tooltip": "Object, default='DecisionTreeClassifier'. The base estimator from which the boosted ensemble is built. Support for sample weighting is required, as well as proper classes_ and n_classes_ attributes. If None, then the base estimator is DecisionTreeClassifier initialized with max_depth=1."
            },
            "n_estimators": {
                "type": "int",
                "default_val": 100,
                "tooltip": "int, default=100. The maximum number of estimators at which boosting is terminated. In case of perfect fit, the learning procedure is stopped early. Values must be in the range [1, inf)."
            },
            "estimator_params": {
                "type": "tuple",
                "default_val": "('criterion', 'max_depth', 'min_samples_split', 'min_samples_leaf', 'min_weight_fraction_leaf', 'max_features', 'max_leaf_nodes', 'min_impurity_decrease', 'random_state', 'ccp_alpha')",
                "tooltip": "tuple, default_val=('criterion', 'max_depth', 'min_samples_split', 'min_samples_leaf', 'min_weight_fraction_leaf', 'max_features', 'max_leaf_nodes', 'min_impurity_decrease', 'random_state', 'ccp_alpha')"
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
                "type": "list",
                "default_val": "gini",
                "tooltip": "<p>Function to measure the quality of a split. Default = <code>gini</code>.</p>\n<ul>\n<li><b>gini</b>: Gini impurity.</li>\n<li><b>entropy</b>: Shannon information gain.</li>\n<li><b>log_loss</b>: Also based on Shannon information gain (for probabilistic splits).</li>\n</ul>",
                "choices": {
                    "gini": "Gini",
                    "entropy": "Entropy",
                    "log_loss": "Log Loss"
                }
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
                "type": "list",
                "default_val": "sqrt",
                "tooltip": "<p>Number of features to consider when looking for the best split. Default = <code>sqrt</code>.</p>\n<ul>\n<li><b>sqrt</b>: Square root of total features.</li>\n<li><b>log2</b>: Log2 of total features.</li>\n<li><b>None</b>: Use all features.</li>\n</ul>\n<p><b>Note :</b> You can also provide float or int manually in the backend.</p>",
                "choices": {
                    "sqrt": "Sqrt (default)",
                    "log2": "Log2",
                    "None": "None (all features)"
                }
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
                "type": "list",
                "default_val": "SAMME.R",
                "tooltip": "<p>Boosting algorithm to use. Default = <code>SAMME.R</code>.</p>\n<ul>\n<li><b>SAMME.R</b>: Real boosting (requires probability estimates). Converges faster.</li>\n<li><b>SAMME</b>: Discrete boosting (uses predicted classes only).</li>\n</ul>",
                "choices": {
                    "SAMME.R": "SAMME.R (real, default)",
                    "SAMME": "SAMME (discrete)"
                }
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
                "type": "list",
                "default_val": "log_loss",
                "tooltip": "<p>Loss function to be optimized. Default = <code>log_loss</code>.</p>\n<p>Supports <code>log_loss</code>, <code>exponential</code>, and <code>hinge</code>.</p>",
                "choices": {
                    "log_loss": "Log Loss (default)",
                    "exponential": "Exponential",
                    "hinge": "Hinge"
                }
            },
            "criterion": {
                "type": "list",
                "default_val": "friedman_mse",
                "tooltip": "<p>Function to measure the quality of a split. Default = <code>friedman_mse</code>.</p>\n<ul>\n<li><b>friedman_mse</b>: Improvement score used in Friedman’s GB.</li>\n<li><b>squared_error</b>: Mean squared error.</li>\n<li><b>mse</b>: Alias for <code>squared_error</code>.</li>\n</ul>",
                "choices": {
                    "friedman_mse": "Friedman MSE (default)",
                    "squared_error": "Squared Error",
                    "mse": "MSE (alias)"
                }
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
                "type": "list",
                "default_val": "svd",
                "tooltip": "<p>Algorithm used to solve the LDA optimization problem. Default = <code>svd</code>.</p>\n<ul>\n<li><b>svd</b>: Does not compute the covariance matrix (default).</li>\n<li><b>lsqr</b>: Least squares solution.</li>\n<li><b>eigen</b>: Eigenvalue decomposition-based solution.</li>\n</ul>",
                "choices": {
                    "svd": "SVD (default)",
                    "lsqr": "LSQR",
                    "eigen": "Eigen"
                }
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
                "type": "list",
                "default_val": "gini",
                "tooltip": "<p>Function to measure the quality of a split. Default = <code>gini</code>.</p>\n<ul>\n<li><b>gini</b>: Gini impurity.</li>\n<li><b>entropy</b>: Shannon information gain.</li>\n<li><b>log_loss</b>: Log loss for probabilistic splits.</li>\n</ul>",
                "choices": {
                    "gini": "Gini (default)",
                    "entropy": "Entropy",
                    "log_loss": "Log Loss"
                }
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
                "type": "list",
                "default_val": "sqrt",
                "tooltip": "<p>Number of features to consider at each split. Default = <code>sqrt</code>.</p>\n<ul>\n<li><b>sqrt</b>: Square root of total features.</li>\n<li><b>log2</b>: Log base 2 of total features.</li>\n<li><b>None</b>: Use all features.</li>\n</ul>",
                "choices": {
                    "sqrt": "Sqrt (default)",
                    "log2": "Log2",
                    "None": "None (all features)"
                }
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
                "type": "list",
                "default_val": "gbdt",
                "tooltip": "<p>Boosting algorithm used. Default = <code>gbdt</code>.</p>\n<ul>\n<li><b>gbdt</b>: Gradient Boosting Decision Tree (default).</li>\n<li><b>dart</b>: Dropouts meet Additive Regression Trees.</li>\n<li><b>goss</b>: Gradient-based One-Side Sampling.</li>\n<li><b>rf</b>: Random Forest.</li>\n</ul>",
                "choices": {
                    "gbdt": "GBDT (default)",
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
                "type": "list",
                "default_val": "split",
                "tooltip": "<p>Type of feature importance to use. Default = <code>split</code>.</p>\n<ul>\n<li><b>split</b>: Number of times the feature is used in the model.</li>\n<li><b>gain</b>: Total gain of splits that use the feature.</li>\n</ul>",
                "choices": {
                    "split": "Split (default)",
                    "gain": "Gain"
                }
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
                "type": "list",
                "default_val": "prior",
                "tooltip": "<p>Strategy to generate predictions. Default = <code>prior</code>.</p>\n<ul>\n<li><b>prior</b>: Always predict the most frequent class (same as <code>most_frequent</code>).</li>\n<li><b>most_frequent</b>: Predict the most frequent class.</li>\n<li><b>stratified</b>: Predict randomly according to class distribution.</li>\n<li><b>uniform</b>: Predict uniformly at random.</li>\n<li><b>constant</b>: Predict a constant label (requires <code>constant</code> parameter).</li>\n</ul>",
                "choices": {
                    "prior": "Prior (default)",
                    "most_frequent": "Most Frequent",
                    "stratified": "Stratified",
                    "uniform": "Uniform",
                    "constant": "Constant"
                }
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
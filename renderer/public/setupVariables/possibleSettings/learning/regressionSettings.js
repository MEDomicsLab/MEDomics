/* eslint-disable */
const regressionSettings = {
    "clean": {
        "options": {
            "imputation_type": {
            "type": "list",
                "default_val": "simple",
                "tooltip": "<p>The type of imputation to use. Default = <code>simple</code>.</p>\n<p><strong>Options:</strong></p>\n<ul>\n<li><code>simple</code>: Basic strategies like mean, median, etc.</li>\n<li><code>iterative</code>: Estimates missing values iteratively using other features.</li>\n<li><code>None</code>: No imputation is performed.</li>\n</ul>",
                "choices": {
                    "simple": "Simple (default)",
                    "iterative": "Iterative"
                }
            },
            "normalize": {
                "type": "bool",
                "tooltip": "<p>When set to True, it transforms the features by scaling them to a given\nrange. Type of scaling is defined by the normalize_method parameter.</p>\n",
                "default_val": "False"
            },
            "normalize_method": {
                "type": "list",
                "default_val": "zscore",
                "tooltip": "<p>Defines the method used for feature scaling. Default = <code>zscore</code>.</p>\n<ul>\n<li><code>zscore</code>: Standard score, z = (x - μ) / σ</li>\n<li><code>minmax</code>: Scales features to the [0, 1] range.</li>\n<li><code>maxabs</code>: Scales by maximum absolute value (preserves sparsity).</li>\n<li><code>robust</code>: Uses interquartile range, robust to outliers.</li>\n</ul>\n<p><em>Ignored if <code>normalize</code> is not set to True.</em></p>",
                "choices": {
                    "zscore": "Z-Score (default)",
                    "minmax": "Min-Max",
                    "maxabs": "MaxAbs",
                    "robust": "Robust"
                }
            },
            "iterative_imputation_iters": {
                "type": "int",
                "tooltip": "<p>Number of iterations. Ignored when imputation_type=simple.</p>\n",
                "default_val": "5"
            },
            "categorical_imputation": {
                "type": "string",
                "tooltip": "<p>Strategy to impute missing categorical values. Ignored if <code>imputation_type = iterative</code>.</p>\n<ul>\n<li><code>drop</code>: Drop rows with missing values.</li>\n<li><code>mode</code>: Fill with most frequent category.</li>\n<li><code>str</code>: Use a custom string value.</li>\n</ul>",
                "default_val": "mode"
            },
            "categorical_iterative_imputer": {
                "type": "string",
                "tooltip": "<p>Regressor for iterative imputation of missing values in categorical features.\nIf None, it uses LGBClassifier. Ignored when imputation_type=simple.</p>\n",
                "default_val": "lightgbm"
            },
            "numeric_imputation": {
                "type": "list",
                "default_val": "mean",
                "tooltip": "<p>Strategy to impute missing numerical values. Ignored if <code>imputation_type = iterative</code>.</p>\n<ul>\n<li><code>drop</code>: Drop rows with missing values.</li>\n<li><code>mean</code>: Impute with mean of the column.</li>\n<li><code>median</code>: Impute with median of the column.</li>\n<li><code>mode</code>: Impute with most frequent value.</li>\n<li><code>knn</code>: Impute using a K-Nearest Neighbors approach.</li>\n<li><code>int</code> or <code>float</code>: Provide a custom numerical value.</li>\n</ul>",
                "choices": {
                    "drop": "Drop rows containing missing values",
                    "mean": "Impute with mean of column (default)",
                    "median": "Impute with median of column",
                    "mode": "Impute with most frequent value",
                    "knn": "Impute using a K-Nearest Neighbors approach"
                }
            },
            "numeric_iterative_imputer": {
                "type": "string",
                "tooltip": "<p>Regressor for iterative imputation of missing values in numeric features.\nIf None, it uses LGBClassifier. Ignored when imputation_type=simple.</p>\n",
                "default_val": "lightgbm"
            },
            "transformation": {
                "type": "bool",
                "tooltip": "<p>When set to True, it applies the power transform to make data more Gaussian-like.\nType of transformation is defined by the transformation_method parameter.</p>\n",
                "default_val": "False"
            },
            "transformation_method": {
                "type": "list",
                "default_val": "yeo-johnson",
                "tooltip": "<p>Method used to transform numerical features. Default = <code>yeo-johnson</code>.</p>\n<ul>\n<li><code>yeo-johnson</code>: Applies a power transform that supports both positive and negative values.</li>\n<li><code>quantile</code>: Maps data to a normal distribution using quantiles.</li>\n</ul>\n<p><em>Ignored if <code>transformation</code> is not set to True.</em></p>",
                "choices": {
                    "yeo-johnson": "Yeo-Johnson (default)",
                    "quantile": "Quantile"
                }
            },
            "pca": {
                "type": "bool",
                "tooltip": "<p>When set to True, dimensionality reduction is applied to project the data into\na lower dimensional space using the method defined in pca_method parameter.</p>\n",
                "default_val": "False"
            },
            "pca_method": {
                "type": "list",
                "default_val": "linear",
                "tooltip": "<p>Method used for Principal Component Analysis (PCA). Default = <code>linear</code>.</p>\n<ul>\n<li><code>linear</code>: Standard PCA using Singular Value Decomposition (SVD).</li>\n<li><code>kernel</code>: PCA using a non-linear kernel (e.g., RBF).</li>\n<li><code>incremental</code>: Memory-efficient version of linear PCA for large datasets.</li>\n</ul>",
                "choices": {
                    "linear": "Linear (default)",
                    "kernel": "Kernel",
                    "incremental": "Incremental"
                }
            },
            "pca_components": {
                "type": "int-float-str",
                "tooltip": "<dl >\n<dt>Number of components to keep. This parameter is ignored when <cite>pca=False</cite>.</dt><dd><ul >\n<li><p>If None: All components are kept.</p></li>\n<li><p>If int: Absolute number of components.</p></li>\n<li><dl >\n<dt>If float: Such an amount that the variance that needs to be explained</dt><dd><p>is greater than the percentage specified by <cite>n_components</cite>.\nValue should lie between 0 and 1 (ony for pca_method=\u2019linear\u2019).</p>\n</dd>\n</dl>\n</li>\n<li><p>If \u201cmle\u201d: Minka\u2019s MLE is used to guess the dimension (ony for pca_method=\u2019linear\u2019).</p></li>\n</ul>\n</dd>\n</dl>\n",
                "default_val": "None"
            },
            "remove_outliers": {
                "type": "bool",
                "tooltip": "<p>When set to True, outliers from the training data are removed using an\nIsolation Forest.</p>\n",
                "default_val": "False"
            },
            "outliers_threshold": {
                "type": "float",
                "tooltip": "<p>The percentage of outliers to be removed from the dataset. Ignored\nwhen remove_outliers=False.</p>\n",
                "default_val": "0.05",
                "min": 0.0,
                "max": 1.0
            },
            "remove_multicollinearity": {
                "type": "bool",
                "tooltip": "<p>When set to True, features with the inter-correlations higher than\nthe defined threshold are removed. For each group, it removes all\nexcept the feature with the highest correlation to <cite>y</cite>.</p>\n",
                "default_val": "False"
            },
            "multicollinearity_threshold": {
                "type": "float",
                "tooltip": "<p>Minimum absolute Pearson correlation to identify correlated\nfeatures. The default value removes equal columns. Ignored when\nremove_multicollinearity is not True.</p>\n",
                "default_val": "0.9",
                "min": 0.0,
                "max": 1.0
            },
            "polynomial_features": {
                "type": "bool",
                "tooltip": "<p>When set to True, new features are derived using existing numeric features.</p>\n",
                "default_val": "False"
            },
            "polynomial_degree": {
                "type": "int",
                "tooltip": "<p>Degree of polynomial features. For example, if an input sample is two dimensional\nand of the form [a, b], the polynomial features with degree = 2 are:\n[1, a, b, a^2, ab, b^2]. Ignored when polynomial_features is not True.</p>\n",
                "default_val": "2",
                "min": 1,
                "max": 5
            },
            "feature_selection": {
                "type": "bool",
                "tooltip": "<p>When set to True, a subset of features is selected based on a feature\nimportance score determined by feature_selection_estimator.</p>\n",
                "default_val": "False"
            },
            "feature_selection_estimator": {
                "type": "string",
                "tooltip": "<p>Classifier used to determine the feature importances. The\nestimator should have a <cite>feature_importances_</cite> or <cite>coef_</cite>\nattribute after fitting. If None, it uses LGBRegressor. This\nparameter is ignored when <cite>feature_selection_method=univariate</cite>.</p>\n",
                "default_val": "lightgbm"
            },
            "feature_selection_method": {
                "type": "list",
                "default_val": "classic",
                "tooltip": "<p>Algorithm used for feature selection. Default = <code>classic</code>.</p>\n<ul>\n<li><code>univariate</code>: Uses SelectKBest from sklearn.</li>\n<li><code>classic</code>: Uses SelectFromModel from sklearn.</li>\n<li><code>sequential</code>: Uses SequentialFeatureSelector.</li>\n</ul>",
                "choices": {
                    "univariate": "Univariate",
                    "classic": "Classic (default)",
                    "sequential": "Sequential"
                }
            },
            "n_features_to_select": {
                "type": "float",
                "tooltip": "<p>The maximum number of features to select with feature_selection. If &lt;1,\nit\u2019s the fraction of starting features. Note that this parameter doesn\u2019t\ntake features in ignore_features or keep_features into account\nwhen counting.</p>\n",
                "default_val": "0.2",
                "min": 0.0,
                "max": 1.0
            }
        },
        "code": ""
    },
    "dataset": {
        "options": {
            "data_func": {
                "type": "data-function",
                "tooltip": "<p>The function that generate data (the dataframe-like input). This\nis useful when the dataset is large, and you need parallel operations\nsuch as compare_models. It can avoid broadcasting large dataset\nfrom driver to workers. Notice one and only one of data and\ndata_func must be set.</p>\n",
                "default_val": ""
            },
            "index": {
                "type": "bool-int-str",
                "tooltip": "<dl >\n<dt>Handle indices in the <cite>data</cite> dataframe.</dt><dd><ul >\n<li><p>If False: Reset to RangeIndex.</p></li>\n<li><p>If True: Keep the provided index.</p></li>\n<li><p>If int: Position of the column to use as index.</p></li>\n<li><p>If str: Name of the column to use as index.</p></li>\n<li><p>If sequence: Array with shape=(n_samples,) to use as index.</p></li>\n</ul>\n</dd>\n</dl>\n",
                "default_val": "True"
            },
            "train_size": {
                "type": "float",
                "tooltip": "<p>Proportion of the dataset to be used for training and validation. Should be\nbetween 0.0 and 1.0.</p>\n",
                "default_val": "0.7",
                "min": 0.1,
                "max": 0.99
            },
            "test_data": {
                "type": "dataframe",
                "tooltip": "<p>If not None, test_data is used as a hold-out set and <cite>train_size</cite> parameter\nis ignored. The columns of data and test_data must match.</p>\n",
                "default_val": "None"
            },
            "ordinal_features": {
                "type": "dict",
                "tooltip": "<p>Categorical features to be encoded ordinally. For example, a categorical\nfeature with \u2018low\u2019, \u2018medium\u2019, \u2018high\u2019 values where low &lt; medium &lt; high can\nbe passed as ordinal_features = {\u2018column_name\u2019 : [\u2018low\u2019, \u2018medium\u2019, \u2018high\u2019]}.</p>\n",
                "default_val": "None"
            },
            "numeric_features": {
                "type": "custom-list",
                "tooltip": "<p>If the inferred data types are not correct, the numeric_features param can\nbe used to define the data types. It takes a list of strings with column\nnames that are numeric.</p>\n",
                "default_val": "None"
            },
            "categorical_features": {
                "type": "custom-list",
                "tooltip": "<p>If the inferred data types are not correct, the categorical_features param\ncan be used to define the data types. It takes a list of strings with column\nnames that are categorical.</p>\n",
                "default_val": "None"
            },
            "date_features": {
                "type": "custom-list",
                "tooltip": "<p>If the inferred data types are not correct, the date_features param can be\nused to overwrite the data types. It takes a list of strings with column\nnames that are DateTime.</p>\n",
                "default_val": "None"
            },
            "text_features": {
                "type": "custom-list",
                "tooltip": "<p>Column names that contain a text corpus. If None, no text features are\nselected.</p>\n",
                "default_val": "None"
            },
            "ignore_features": {
                "type": "custom-list",
                "tooltip": "<p>ignore_features param can be used to ignore features during preprocessing\nand model training. It takes a list of strings with column names that are\nto be ignored.</p>\n",
                "default_val": "None"
            },
            "keep_features": {
                "type": "custom-list",
                "tooltip": "<p>keep_features param can be used to always keep specific features during\npreprocessing, i.e. these features are never dropped by any kind of\nfeature selection. It takes a list of strings with column names that are\nto be kept.</p>\n",
                "default_val": "None"
            },
            "preprocess": {
                "type": "bool",
                "tooltip": "<p>When set to False, no transformations are applied except for train_test_split\nand custom transformations passed in custom_pipeline param. Data must be\nready for modeling (no missing values, no dates, categorical data encoding),\nwhen preprocess is set to False.</p>\n",
                "default_val": "True"
            },
            "create_date_columns": {
                "type": "custom-list",
                "tooltip": "<p>Columns to create from the date features. Note that created features\nwith zero variance (e.g. the feature hour in a column that only contains\ndates) are ignored. Allowed values are datetime attributes from\n<cite>pandas.Series.dt</cite>. The datetime format of the feature is inferred\nautomatically from the first non NaN value.</p>\n",
                "default_val": "[\u201cday\u201d, \u201cmonth\u201d, \u201cyear\u201d]"
            },
            "text_features_method": {
                "type": "string",
                "tooltip": "<p>Method with which to embed the text features in the dataset. Choose\nbetween \u201cbow\u201d (Bag of Words - CountVectorizer) or \u201ctf-idf\u201d (TfidfVectorizer).\nBe aware that the sparse matrix output of the transformer is converted\ninternally to its full array. This can cause memory issues for large\ntext embeddings.</p>\n",
                "default_val": "\u201ctf-idf\u201d"
            },
            "max_encoding_ohe": {
                "type": "int",
                "tooltip": "<p>Categorical columns with <cite>max_encoding_ohe</cite> or less unique values are\nencoded using OneHotEncoding. If more, the <cite>encoding_method</cite> estimator\nis used. Note that columns with exactly two classes are always encoded\nordinally. Set to below 0 to always use OneHotEncoding.</p>\n",
                "default_val": "25"
            },
            "encoding_method": {
                "type": "category-encoders estimator",
                "tooltip": "<p>A <cite>category-encoders</cite> estimator to encode the categorical columns\nwith more than <cite>max_encoding_ohe</cite> unique values. If None,\n<cite>category_encoders.target_encoder.TargetEncoder</cite> is used.</p>\n",
                "default_val": "None"
            },
            "rare_to_value": {
                "type": "float",
                "tooltip": "<p>Minimum fraction of category occurrences in a categorical column.\nIf a category is less frequent than <cite>rare_to_value * len(X)</cite>, it is\nreplaced with the string in <cite>rare_value</cite>. Use this parameter to group\nrare categories before encoding the column. If None, ignores this step.</p>\n",
                "default_val": "one"
            },
            "rare_value": {
                "type": "string",
                "tooltip": "<p>Value with which to replace rare categories. Ignored when\nrare_to_value is None.</p>\n",
                "default_val": "rare\u201d"
            },
            "low_variance_threshold": {
                "type": "float",
                "tooltip": "<p>Remove features with a training-set variance lower than the provided\nthreshold. If 0, keep all features with non-zero variance, i.e. remove\nthe features that have the same value in all samples. If None, skip\nthis transformation step.</p>\n",
                "default_val": "None"
            },
            "group_features": {
                "type": "dict",
                "tooltip": "<p>When the dataset contains features with related characteristics,\nadd new fetaures with the following statistical properties of that\ngroup: min, max, mean, std, median and mode. The parameter takes a\ndict with the group name as key and a list of feature names\nbelonging to that group as value.</p>\n",
                "default_val": "None"
            },
            "drop_groups": {
                "type": "bool",
                "tooltip": "<p>Whether to drop the original features in the group. Ignored when\ngroup_features is None.</p>\n",
                "default_val": "alse"
            },
            "bin_numeric_features": {
                "type": "custom-list",
                "tooltip": "<p>To convert numeric features into categorical, bin_numeric_features parameter can\nbe used. It takes a list of strings with column names to be discretized. It does\nso by using \u2018sturges\u2019 rule to determine the number of clusters and then apply\nKMeans algorithm. Original values of the feature are then replaced by the\ncluster label.</p>\n",
                "default_val": "None"
            },
            "outliers_method": {
                "type": "list",
                "default_val": "iforest",
                "tooltip": "<p>Method used to detect and remove outliers. Ignored if <code>remove_outliers = False</code>.</p>\n<ul>\n<li><code>iforest</code>: Isolation Forest (sklearn).</li>\n<li><code>ee</code>: Elliptic Envelope (sklearn).</li>\n<li><code>lof</code>: Local Outlier Factor (sklearn).</li>\n</ul>",
                "choices": {
                    "iforest": "Isolation Forest (default)",
                    "ee": "Elliptic Envelope",
                    "lof": "Local Outlier Factor"
                }
            },
            "transform_target": {
                "type": "bool",
                "tooltip": "<p>When set to True, target variable is transformed using the method defined in\ntransform_target_method param. Target transformation is applied separately\nfrom feature transformations.</p>\n",
                "default_val": "False"
            },
            "transform_target_method": {
                "type": "list",
                "default_val": "yeo-johnson",
                "tooltip": "<p>Method used to transform the target variable. Default = <code>yeo-johnson</code>.</p>\n<ul>\n<li><code>yeo-johnson</code>: Supports positive and negative values.</li>\n<li><code>quantile</code>: Maps target to a normal distribution using quantiles.</li>\n</ul>\n<p><em>Ignored if <code>transform_target</code> is not set to True.</em></p>",
                "choices": {
                    "yeo-johnson": "Yeo-Johnson (default)",
                    "quantile": "Quantile"
                }
            },
            "custom_pipeline": {
                "type": "list of (str, transformer), dict or Pipeline",
                "tooltip": "<p>Addidiotnal custom transformers. If passed, they are applied to the\npipeline last, after all the build-in transformers.</p>\n",
                "default_val": "None"
            },
            "custom_pipeline_position": {
                "type": "int",
                "tooltip": "<p>Position of the custom pipeline in the overal preprocessing pipeline.\nThe default value adds the custom pipeline last.</p>\n",
                "default_val": "-1"
            },
            "data_split_shuffle": {
                "type": "bool",
                "tooltip": "<p>When set to False, prevents shuffling of rows during \u2018train_test_split\u2019.</p>\n",
                "default_val": "True"
            },
            "data_split_stratify": {
                "type": "bool",
                "tooltip": "<p>Controls stratification during \u2018train_test_split\u2019. When set to True, will\nstratify by target column. To stratify on any other columns, pass a list of\ncolumn names. Ignored when data_split_shuffle is False.</p>\n",
                "default_val": "False"
            },
            "fold_strategy": {
                "type": "list",
                "default_val": "kfold",
                "tooltip": "<p>Strategy used for cross-validation. Default = <code>kfold</code>.</p>\n<ul>\n<li><code>kfold</code>: Standard K-Fold split.</li>\n<li><code>groupkfold</code>: K-Fold with non-overlapping groups. Requires <code>fold_groups</code>.</li>\n<li><code>timeseries</code>: Preserves temporal order.</li>\n</ul>\n<p><em>You may also pass a custom CV generator compatible with scikit-learn.</em></p>",
                "choices": {
                    "kfold": "KFold (default)",
                    "groupkfold": "GroupKFold",
                    "timeseries": "TimeSeriesSplit"
                }
            },
            "fold": {
                "type": "int",
                "tooltip": "<p>Number of folds to be used in cross validation. Must be at least 2. This is\na global setting that can be over-written at function level by using fold\nparameter. Ignored when fold_strategy is a custom object.</p>\n",
                "default_val": "10",
                "min": 2,
                "max": 20
            },
            "fold_shuffle": {
                "type": "bool",
                "tooltip": "<p>Controls the shuffle parameter of CV. Only applicable when fold_strategy\nis \u2018kfold\u2019 or \u2018stratifiedkfold\u2019. Ignored when fold_strategy is a custom\nobject.</p>\n",
                "default_val": "False"
            },
            "fold_groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when \u2018GroupKFold\u2019 is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in the training dataset. When string is passed, it is interpreted\nas the column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            },
            "n_jobs": {
                "type": "int",
                "tooltip": "<p>The number of jobs to run in parallel (for functions that supports parallel\nprocessing) -1 means using all processors. To run all functions on single\nprocessor set n_jobs to None.</p>\n",
                "default_val": "-1"
            },
            "use_gpu": {
                "type": "list",
                "tooltip": "<p>When set to True, it will use GPU for training with algorithms that support it,\nand fall back to CPU if they are unavailable. When set to \u2018force\u2019, it will only\nuse GPU-enabled algorithms and raise exceptions when they are unavailable. When\nFalse, all algorithms are trained using CPU only.</p>\n<p>GPU enabled algorithms:</p>\n<ul >\n<li><p>Extreme Gradient Boosting, requires no further installation</p></li>\n<li><p>CatBoost Classifier, requires no further installation</p></li>\n</ul>\n<p>(GPU is only enabled when data &gt; 50,000 rows)</p>\n<ul >\n<li><p>Light Gradient Boosting Machine, requires GPU installation</p></li>\n</ul>\n<p>https://lightgbm.readthedocs.io/en/latest/GPU-Tutorial.html</p>\n<ul >\n<li><p>Linear Regression, Lasso Regression, Ridge Regression, K Neighbors Regressor,</p></li>\n</ul>\n<p>Random Forest, Support Vector Regression, Elastic Net requires cuML &gt;= 0.15\nhttps://github.com/rapidsai/cuml</p>\n",
                "default_val": "False",
                "choices": {
                    "False": "tooltip False",
                    "True": "tooltip True",
                    "force": "tooltip force"
                }
            },
            "html": {
                "type": "bool",
                "tooltip": "<p>When set to False, prevents runtime display of monitor. This must be set to False\nwhen the environment does not support IPython. For example, command line terminal,\nDatabricks Notebook, Spyder and other similar IDEs.</p>\n",
                "default_val": "True"
            },
            "session_id": {
                "type": "int",
                "tooltip": "<p>Controls the randomness of experiment. It is equivalent to \u2018random_state\u2019 in\nscikit-learn. When None, a pseudo random number is generated. This can be used\nfor later reproducibility of the entire experiment.</p>\n",
                "default_val": "42"
            },
            "experiment_name": {
                "type": "string",
                "tooltip": "<p>Name of the experiment for logging. Ignored when log_experiment is False.</p>\n",
                "default_val": "None"
            },
            "experiment_custom_tags": {
                "type": "dict",
                "tooltip": "<p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n",
                "default_val": "None"
            },
            "log_plots": {
                "type": "bool",
                "tooltip": "<p>When set to True, certain plots are logged automatically in the MLFlow server.\nTo change the type of plots to be logged, pass a list containing plot IDs. Refer\nto documentation of plot_model. Ignored when log_experiment is False.</p>\n",
                "default_val": "False"
            },
            "log_profile": {
                "type": "bool",
                "tooltip": "<p>When set to True, data profile is logged on the MLflow server as a html file.\nIgnored when log_experiment is False.</p>\n",
                "default_val": "False"
            },
            "log_data": {
                "type": "bool",
                "tooltip": "<p>When set to True, dataset is logged on the MLflow server as a csv file.\nIgnored when log_experiment is False.</p>\n",
                "default_val": "False"
            },
            "engine": {
                "type": "Optional[Dict[str, str]] = None",
                "tooltip": "<p>The execution engines to use for the models in the form of a dict\nof <cite>model_id: engine</cite> - e.g. for Linear Regression (\u201clr\u201d, users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engine={\u201clr\u201d: \u201csklearnex\u201d}</cite></p>\n",
                "default_val": ""
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>When set to False, Information grid is not printed.</p>\n",
                "default_val": "True"
            },
            "memory": {
                "type": "str, bool or Memory",
                "tooltip": "<dl >\n<dt>Used to cache the fitted transformers of the pipeline.</dt><dd><p>If False: No caching is performed.\nIf True: A default temp directory is used.\nIf str: Path to the caching directory.</p>\n</dd>\n</dl>\n",
                "default_val": "rue"
            },
            "profile": {
                "type": "bool",
                "tooltip": "<p>When set to True, an interactive EDA report is displayed.</p>\n",
                "default_val": "False"
            },
            "profile_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the ProfileReport method used\nto create the EDA report. Ignored if profile is False.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "time-point": {
                "type": "string",
                "default_val": "",
                "tooltip": "<p>Time point relative to where analysis is performed</p>"
            },
            "split_experiment_by_institutions": {
                "type": "bool",
                "default_val": "False",
                "tooltip": "<p>Set this to true for analysis by institutions</p>"
            }
        },
        "code": "",
        "default": {
            "files": {
                "type": "data-input",
                "tooltip": "<p>Specify path to csv file or to medomics folder</p>"
            }
        }
    },
    "optimize": {
        "subNodes": [
            "tune_model",
            "ensemble_model",
            "blend_models",
            "stack_models"
        ],
        "options": {},
        "code": ""
    },
    "compare_models": {
        "options": {
            "include": {
                "type": "list-multiple",
                "tooltip": "<p>To train and evaluate select models, list containing model ID or scikit-learn\ncompatible object can be passed in include param. To see a list of all models\navailable in the model library use the models function.</p>\n",
                "default_val": "None",
                "choices": {
                    "lr": "Linear Regression",
                    "lasso": "Lasso Regression",
                    "ridge": "Ridge Regression",
                    "en": "Elastic Net",
                    "lar": "Least Angle Regression",
                    "llar": "Lasso Least Angle Regression",
                    "omp": "Orthogonal Matching Pursuit",
                    "br": "Bayesian Ridge",
                    "ard": "Automatic Relevance Determination",
                    "par": "Passive Aggressive Regressor",
                    "ransac": "Random Sample Consensus",
                    "tr": "TheilSen Regressor",
                    "huber": "Huber Regressor",
                    "kr": "Kernel Ridge",
                    "svm": "Support Vector Regression",
                    "knn": "K Neighbors Regressor",
                    "dt": "Decision Tree Regressor",
                    "rf": "Random Forest Regressor",
                    "et": "Extra Trees Regressor",
                    "ada": "AdaBoost Regressor",
                    "gbr": "Gradient Boosting Regressor",
                    "mlp": "MLP Regressor",
                    "xgboost": "Extreme Gradient Boosting",
                    "lightgbm": "Light Gradient Boosting Machine",
                    "catboost": "CatBoost Regressor"
                }
            },
            "exclude": {
                "type": "custom-list",
                "tooltip": "<p>To omit certain models from training and evaluation, pass a list containing\nmodel id in the exclude parameter. To see a list of all models available\nin the model library use the models function.</p>\n",
                "default_val": "None"
            },
            "fold": {
                "type": "int",
                "tooltip": "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
                "default_val": "None",
                "min": 2,
                "max": 20
            },
            "round": {
                    "type": "int",
                    "tooltip": "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
                    "default_val": "4",
                    "min": 0,
                    "max": 6
            },
            "cross_validation": {
                "type": "bool",
                "tooltip": "<p>When set to False, metrics are evaluated on holdout set. fold param\nis ignored when cross_validation is set to False.</p>\n",
                "default_val": "True"
            },
            "sort": {
                "type": "string",
                "tooltip": "<p>The sort order of the score grid. It also accepts custom metrics that are\nadded through the add_metric function.</p>\n",
                "default_val": "R2"
            },
            "n_select": {
                "type": "int",
                "tooltip": "<p>Number of top_n models to return. For example, to select top 3 models use\nn_select = 3.</p>\n",
                "default_val": "1",
                "min": 1,
                "max": 20
            },
            "budget_time": {
                "type": "float",
                "tooltip": "<p>If not None, will terminate execution of the function after budget_time\nminutes have passed and return results up to that point.</p>\n",
                "default_val": "None"
            },
            "turbo": {
                "type": "bool",
                "tooltip": "<p>When set to True, it excludes estimators with longer training times. To\nsee which algorithms are excluded use the models function.</p>\n",
                "default_val": "True"
            },
            "errors": {
                "type": "string",
                "tooltip": "<p>When set to \u2018ignore\u2019, will skip the model with exceptions and continue.\nIf \u2018raise\u2019, will break the function when exceptions are raised.</p>\n",
                "default_val": "ignore"
            },
            "fit_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when \u2018GroupKFold\u2019 is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in the training dataset. When string is passed, it is interpreted\nas the column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            },
            "engine": {
                "type": "Optional[Dict[str, str]] = None",
                "tooltip": "<p>The execution engines to use for the models in the form of a dict\nof <cite>model_id: engine</cite> - e.g. for Linear Regression (\u201clr\u201d, users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engine={\u201clr\u201d: \u201csklearnex\u201d}</cite></p>\n",
                "default_val": ""
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>Score grid is not printed when verbose is set to False.</p>\n",
                "default_val": "True"
            }
        },
        "code": " "
    },
    "create_model": {
        "options": {
            "fold": {
                "type": "int",
                "tooltip": "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
                "default_val": "None",
                "min": 2,
                "max": 20
            },
            "round": {
                "type": "int",
                "tooltip": "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
                "default_val": "4",
                "min": 0,
                "max": 6
            },
            "cross_validation": {
                "type": "bool",
                "tooltip": "<p>When set to False, metrics are evaluated on holdout set. fold param\nis ignored when cross_validation is set to False.</p>\n",
                "default_val": "True"
            },
            "fit_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            },
            "experiment_custom_tags": {
                "type": "dict",
                "tooltip": "<p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n",
                "default_val": "None"
            },
            "engine": {
                "type": "Optional[str] = None",
                "tooltip": "<p>The execution engine to use for the model, e.g. for Linear Regression (\u201clr\u201d), users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engine=\u201dsklearnex\u201d</cite>.</p>\n",
                "default_val": ""
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>Score grid is not printed when verbose is set to False.</p>\n",
                "default_val": "True"
            },
            "return_train_score": {
                "type": "bool",
                "tooltip": "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
                "default_val": "False"
            }
        },
        "code": "",
        "default": {}
    },
    "analyze": {
        "plot_model": {
            "options": {
                "plot": {
                    "type": "list",
                    "default_val": "residual",
                    "tooltip": "<p>Available plots for model evaluation. Default = <code>residual</code>.</p>\n<ul>\n<li><code>pipeline</code>: Schematic view of preprocessing steps</li>\n<li><code>residuals_interactive</code>: Interactive residual plots</li>\n<li><code>residuals</code>: Standard residuals plot</li>\n<li><code>error</code>: Prediction error plot</li>\n<li><code>cooks</code>: Cook's distance plot</li>\n<li><code>rfe</code>: Recursive feature elimination</li>\n<li><code>learning</code>: Learning curve</li>\n<li><code>vc</code>: Validation curve</li>\n<li><code>manifold</code>: Manifold learning projection</li>\n<li><code>feature</code>: Feature importance</li>\n<li><code>feature_all</code>: Full feature importance</li>\n<li><code>parameter</code>: Hyperparameter analysis</li>\n<li><code>tree</code>: Decision tree diagram</li>\n</ul>",
                    "choices": {
                        "pipeline": "Pipeline",
                        "residuals_interactive": "Residuals (Interactive)",
                        "residuals": "Residuals",
                        "error": "Prediction Error",
                        "cooks": "Cook's Distance",
                        "rfe": "Recursive Feature Elimination",
                        "learning": "Learning Curve",
                        "vc": "Validation Curve",
                        "manifold": "Manifold Learning",
                        "feature": "Feature Importance",
                        "feature_all": "Feature Importance (All)",
                        "parameter": "Model Hyperparameter",
                        "tree": "Decision Tree"
                    }
                },
                "scale": {
                    "type": "float",
                    "tooltip": "<p>The resolution scale of the figure.</p>\n",
                    "default_val": "1"
                },
                "fold": {
                    "type": "int",
                    "tooltip": "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
                    "default_val": "None",
                    "min": 2,
                    "max": 20
                },
                "fit_kwargs": {
                    "type": "dict",
                    "tooltip": "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
                    "default_val": "{} (empty dict)"
                },
                "plot_kwargs": {
                    "type": "dict",
                    "tooltip": "<dl >\n<dt>Dictionary of arguments passed to the visualizer class.</dt><dd><ul >\n<li><p>pipeline: fontsize -&gt; int</p></li>\n</ul>\n</dd>\n</dl>\n",
                    "default_val": "{} (empty dict)"
                },
                "groups": {
                    "type": "string",
                    "tooltip": "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
                    "default_val": "None"
                },
                "verbose": {
                    "type": "bool",
                    "tooltip": "<p>When set to False, backend's progress bar is not displayed.</p>\n",
                    "default_val": "True"
                },
                "display_format": {
                    "type": "string",
                    "tooltip": "<p>To display plots in Streamlit (https://www.streamlit.io/), set this to \u2018streamlit\u2019.\nCurrently, not all plots are supported.</p>\n",
                    "default_val": "None"
                }
            },
            "code": "plot_model()",
            "default": {}
        },
        "interpret_model": {
            "options": {
                "plot": {
                    "type": "list",
                    "default_val": "summary",
                    "tooltip": "<p>Type of plot for model interpretation. Default = <code>summary</code>.</p>\n<ul>\n<li><code>summary</code>: Summary Plot using SHAP</li>\n<li><code>correlation</code>: Dependence Plot using SHAP</li>\n<li><code>reason</code>: Force Plot using SHAP</li>\n<li><code>pdp</code>: Partial Dependence Plot</li>\n<li><code>msa</code>: Morris Sensitivity Analysis</li>\n<li><code>pfi</code>: Permutation Feature Importance</li>\n</ul>",
                    "choices": {
                        "summary": "SHAP - Summary (default)",
                        "correlation": "SHAP - Dependence",
                        "reason": "SHAP - Force",
                        "pdp": "Partial Dependence Plot (PDP)",
                        "msa": "Morris Sensitivity Analysis (MSA)",
                        "pfi": "Permutation Feature Importance (PFI)"
                    }
                },
                "feature": {
                    "type": "string",
                    "tooltip": "<p>This parameter is only needed when plot = \u2018correlation\u2019 or \u2018pdp\u2019.\nBy default feature is set to None which means the first column of the\ndataset will be used as a variable. A feature parameter must be passed\nto change this.</p>\n",
                    "default_val": "None"
                },
                "observation": {
                    "type": "int",
                    "tooltip": "<p>This parameter only comes into effect when plot is set to \u2018reason\u2019. If no\nobservation number is provided, it will return an analysis of all observations\nwith the option to select the feature on x and y axes through drop down\ninteractivity. For analysis at the sample level, an observation parameter must\nbe passed with the index value of the observation in test / hold-out set.</p>\n",
                    "default_val": "None"
                },
                "use_train_data": {
                    "type": "bool",
                    "tooltip": "<p>When set to true, train data will be used for plots, instead\nof test data.</p>\n",
                    "default_val": "False"
                },
                "X_new_sample": {
                    "type": "dataframe",
                    "tooltip": "<p>Row from an out-of-sample dataframe (neither train nor test data) to be plotted.\nThe sample must have the same columns as the raw input train data, and it is transformed\nby the preprocessing pipeline automatically before plotting.</p>\n",
                    "default_val": "None"
                },
                "y_new_sample": {
                    "type": "dataframe",
                    "tooltip": "<p>Row from an out-of-sample dataframe (neither train nor test data) to be plotted.\nThe sample must have the same columns as the raw input label data, and it is transformed\nby the preprocessing pipeline automatically before plotting.</p>\n",
                    "default_val": "None"
                }
            },
            "code": "interpret_model()",
            "default": {}
        },
        "dashboard": {
            "options": {
                "display_format": {
                    "type": "string",
                    "tooltip": "<p>Render mode for the dashboard. The default is set to dash which will\nrender a dashboard in browser. There are four possible options:</p>\n<ul >\n<li><p>\u2018dash\u2019 - displays the dashboard in browser</p></li>\n<li><p>\u2018inline\u2019 - displays the dashboard in the jupyter notebook cell.</p></li>\n<li><p>\u2018jupyterlab\u2019 - displays the dashboard in jupyterlab pane.</p></li>\n<li><p>\u2018external\u2019 - displays the dashboard in a separate tab. (use in Colab)</p></li>\n</ul>\n",
                    "default_val": "dash"
                },
                "dashboard_kwargs": {
                    "type": "dict",
                    "tooltip": "<p>Dictionary of arguments passed to the ExplainerDashboard class.</p>\n",
                    "default_val": "{} (empty dict)"
                },
                "run_kwargs": {
                    "type": "dict",
                    "tooltip": "<p>Dictionary of arguments passed to the run method of ExplainerDashboard.</p>\n",
                    "default_val": "{} (empty dict)"
                }
            },
            "code": "dashboard()",
            "default": {}
        }
    },
    "finalize": {
        "options": {
            "fit_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            },
            "model_only": {
                "type": "bool",
                "tooltip": "<p>Whether to return the complete fitted pipeline or only the fitted model.</p>\n",
                "default_val": "False"
            },
            "experiment_custom_tags": {
                "type": "dict",
                "tooltip": "<p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified if\nnot) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n",
                "default_val": "None"
            }
        },
        "code": "",
        "default": {}
    },
    "save_model": {
        "options": {
            "model_name": {
                "type": "string",
                "tooltip": "<p>Name of the model.</p>\n",
                "default_val": "model"
            },
            "model_only": {
                "type": "bool",
                "tooltip": "<p>When set to True, only trained model object is saved instead of the\nentire pipeline.</p>\n",
                "default_val": "False"
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>Success message is not printed when verbose is set to False.</p>\n",
                "default_val": "True"
            }
        },
        "code": "",
        "default": {}
    },
    "load_model": {
        "options": {
            "platform": {
                "type": "list",
                "default_val": "None",
                "tooltip": "<p>Name of the cloud platform. Default = <code>None</code>.</p>\n<ul>\n<li><code>aws</code>: Amazon Web Services</li>\n<li><code>gcp</code>: Google Cloud Platform</li>\n<li><code>azure</code>: Microsoft Azure</li>\n<li><code>None</code>: No cloud platform used</li>\n</ul>",
                "choices": {
                    "aws": "Amazon Web Services (AWS)",
                    "gcp": "Google Cloud Platform (GCP)",
                    "azure": "Microsoft Azure"
                }
            },
            "authentication": {
                "type": "dict",
                "tooltip": "<p>dictionary of applicable authentication tokens.</p>\n<p>when platform = \u2018aws\u2019:\n{\u2018bucket\u2019 : \u2018Name of Bucket on S3\u2019, \u2018path\u2019: (optional) folder name under the bucket}</p>\n<p>when platform = \u2018gcp\u2019:\n{\u2018project\u2019: \u2018gcp-project-name\u2019, \u2018bucket\u2019 : \u2018gcp-bucket-name\u2019}</p>\n<p>when platform = \u2018azure\u2019:\n{\u2018container\u2019: \u2018azure-container-name\u2019}</p>\n",
                "default_val": "None"
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>Success message is not printed when verbose is set to False.</p>\n",
                "default_val": "True"
            }
        },
        "code": "",
        "default": {
            "model_to_load": {
                "type": "models-input",
                "tooltip": "<p>Choose a model from the MODELS folder</p>"
            }
        }
    },
    "tune_model": {
        "options": {
            "fold": {
                "type": "int",
                "tooltip": "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
                "default_val": "None",
                "min": 2,
                "max": 20
            },
            "round": {
                "type": "int",
                "tooltip": "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
                "default_val": "4",
                "min": 0,
                "max": 6
            },
            "n_iter": {
                "type": "int",
                "tooltip": "<p>Number of iterations in the grid search. Increasing \u2018n_iter\u2019 may improve\nmodel performance but also increases the training time.</p>\n",
                "default_val": "10",
                "min": 1,
                "max": 200
            },
            "custom_grid": {
                "type": "dict",
                "tooltip": "<p>To define custom search space for hyperparameters, pass a dictionary with\nparameter name and values to be iterated. Custom grids must be in a format\nsupported by the defined search_library.</p>\n",
                "default_val": "None"
            },
            "optimize": {
                "type": "string",
                "tooltip": "<p>Metric name to be evaluated for hyperparameter tuning. It also accepts custom\nmetrics that are added through the add_metric function.</p>\n",
                "default_val": "R2"
            },
            "custom_scorer": {
                "type": "object",
                "tooltip": "<p>custom scoring strategy can be passed to tune hyperparameters of the model.\nIt must be created using sklearn.make_scorer. It is equivalent of adding\ncustom metric using the add_metric function and passing the name of the\ncustom metric in the optimize parameter.\nWill be deprecated in future.</p>\n",
                "default_val": "None"
            },
            "search_library": {
                "type": "string",
                "tooltip": "<p>The search library used for tuning hyperparameters. Possible values:</p>\n<ul >\n<li><dl >\n<dt>\u2018scikit-learn\u2019 - default, requires no further installation</dt><dd><p>https://github.com/scikit-learn/scikit-learn</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018scikit-optimize\u2019 - pip install scikit-optimize</dt><dd><p>https://scikit-optimize.github.io/stable/</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018tune-sklearn\u2019 - pip install tune-sklearn ray[tune]</dt><dd><p>https://github.com/ray-project/tune-sklearn</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018optuna\u2019 - pip install optuna</dt><dd><p>https://optuna.org/</p>\n</dd>\n</dl>\n</li>\n</ul>\n",
                "default_val": "scikit-learn"
            },
            "search_algorithm": {
                "type": "string",
                "tooltip": "<p>The search algorithm depends on the search_library parameter.\nSome search algorithms require additional libraries to be installed.\nIf None, will use search library-specific default algorithm.</p>\n<ul >\n<li><dl >\n<dt>\u2018scikit-learn\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : random grid search (default)</p></li>\n<li><p>\u2018grid\u2019 : grid search</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018scikit-optimize\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018bayesian\u2019 : Bayesian search (default)</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018tune-sklearn\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : random grid search (default)</p></li>\n<li><p>\u2018grid\u2019 : grid search</p></li>\n<li><p>\u2018bayesian\u2019 : pip install scikit-optimize</p></li>\n<li><p>\u2018hyperopt\u2019 : pip install hyperopt</p></li>\n<li><p>\u2018optuna\u2019 : pip install optuna</p></li>\n<li><p>\u2018bohb\u2019 : pip install hpbandster ConfigSpace</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018optuna\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : randomized search</p></li>\n<li><p>\u2018tpe\u2019 : Tree-structured Parzen Estimator search (default)</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n</ul>\n",
                "default_val": "None"
            },
            "early_stopping": {
                "type": "string",
                "tooltip": "<p>Use early stopping to stop fitting to a hyperparameter configuration\nif it performs poorly. Ignored when search_library is scikit-learn,\nor if the estimator does not have \u2018partial_fit\u2019 attribute. If False or\nNone, early stopping will not be used. Can be either an object accepted\nby the search library or one of the following:</p>\n<ul >\n<li><p>\u2018asha\u2019 for Asynchronous Successive Halving Algorithm</p></li>\n<li><p>\u2018hyperband\u2019 for Hyperband</p></li>\n<li><p>\u2018median\u2019 for Median Stopping Rule</p></li>\n<li><p>If False or None, early stopping will not be used.</p></li>\n</ul>\n",
                "default_val": "False"
            },
            "early_stopping_max_iters": {
                "type": "int",
                "tooltip": "<p>Maximum number of epochs to run for each sampled configuration.\nIgnored if early_stopping is False or None.</p>\n",
                "default_val": "10",
                "min": 1,
                "max": 200
            },
            "choose_better": {
                "type": "bool",
                "tooltip": "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
                "default_val": "True"
            },
            "fit_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the fit method of the tuner.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            },
            "return_tuner": {
                "type": "bool",
                "tooltip": "<p>When set to True, will return a tuple of (model, tuner_object).</p>\n",
                "default_val": "False"
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>Score grid is not printed when verbose is set to False.</p>\n",
                "default_val": "True"
            },
            "tuner_verbose": {
                "type": "int",
                "tooltip": "<p>If True or above 0, will print messages from the tuner. Higher values\nprint more messages. Ignored when verbose param is False.</p>\n",
                "default_val": 0
            },
            "return_train_score": {
                "type": "bool",
                "tooltip": "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
                "default_val": "False"
            }
        },
        "ml_types": "classification regression survival_analysis",
        "code": "tune_model()",
        "default": {}
    },
    "ensemble_model": {
        "options": {
            "method": {
                "type": "string",
                "tooltip": "<p>Method for ensembling base estimator. It can be \u2018Bagging\u2019 or \u2018Boosting\u2019.</p>\n",
                "default_val": "Bagging"
            },
            "fold": {
                "type": "int",
                "tooltip": "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
                "default_val": "None",
                "min": 2,
                "max": 20
            },
            "n_estimators": {
                "type": "int",
                "tooltip": "<p>The number of base estimators in the ensemble. In case of perfect fit, the\nlearning procedure is stopped early.</p>\n",
                "default_val": "10",
                "min": 1,
                "max": 200
            },
            "round": {
                "type": "int",
                "tooltip": "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
                "default_val": "4",
                "min": 0,
                "max": 6
            },
            "choose_better": {
                "type": "bool",
                "tooltip": "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
                "default_val": "False"
            },
            "optimize": {
                "type": "string",
                "tooltip": "<p>Metric to compare for model selection when choose_better is True.</p>\n",
                "default_val": "R2"
            },
            "fit_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            }
        },
        "ml_types": "classification regression",
        "code": "ensemble_model()",
        "default": {}
    },
    "blend_models": {
        "options": {
            "fold": {
                "type": "int",
                "tooltip": "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
                "default_val": "None",
                "min": 2,
                "max": 20
            },
            "round": {
                "type": "int",
                "tooltip": "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
                "default_val": "4",
                "min": 0,
                "max": 6
             },
            "choose_better": {
                "type": "bool",
                "tooltip": "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
                "default_val": "False"
            },
            "optimize": {
                "type": "string",
                "tooltip": "<p>Metric to compare for model selection when choose_better is True.</p>\n",
                "default_val": "R2"
            },
            "weights": {
                "type": "custom-list",
                "tooltip": "<p>Sequence of weights (float or int) to weight the occurrences of predicted class\nlabels (hard voting) or class probabilities before averaging (soft voting). Uses\nuniform weights when None.</p>\n",
                "default_val": "None"
            },
            "fit_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>Score grid is not printed when verbose is set to False.</p>\n",
                "default_val": "True"
            },
            "return_train_score": {
                "type": "bool",
                "tooltip": "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
                "default_val": "False"
            }
        },
        "ml_types": "classification regression",
        "code": "blend_models()",
        "default": {}
    },
    "stack_models": {
        "options": {
            "meta_model": {
                "type": "list",
                "tooltip": "<p>When None, Linear Regression is trained as a meta model.</p>\n",
                "default_val": "None",
                "choices": {
                    "lr": "Linear Regression",
                    "lasso": "Lasso Regression",
                    "ridge": "Ridge Regression",
                    "en": "Elastic Net",
                    "lar": "Least Angle Regression",
                    "llar": "Lasso Least Angle Regression",
                    "omp": "Orthogonal Matching Pursuit",
                    "br": "Bayesian Ridge",
                    "ard": "Automatic Relevance Determination",
                    "par": "Passive Aggressive Regressor",
                    "ransac": "Random Sample Consensus",
                    "tr": "TheilSen Regressor",
                    "huber": "Huber Regressor",
                    "kr": "Kernel Ridge",
                    "svm": "Support Vector Regression",
                    "knn": "K Neighbors Regressor",
                    "dt": "Decision Tree Regressor",
                    "rf": "Random Forest Regressor",
                    "et": "Extra Trees Regressor",
                    "ada": "AdaBoost Regressor",
                    "gbr": "Gradient Boosting Regressor",
                    "mlp": "MLP Regressor",
                    "xgboost": "Extreme Gradient Boosting",
                    "lightgbm": "Light Gradient Boosting Machine",
                    "catboost": "CatBoost Regressor"
                }
            },
            "meta_model_fold": {
                "type": "int",
                "tooltip": "<p>Controls internal cross-validation. Can be an integer or a scikit-learn\nCV generator. If set to an integer, will use (Stratifed)KFold CV with\nthat many folds. See scikit-learn documentation on Stacking for\nmore details.</p>\n",
                "default_val": "5"
            },
            "fold": {
                "type": "int",
                "tooltip": "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
                "default_val": "None",
                "min": 2,
                "max": 20
            },
            "round": {
                "type": "int",
                "tooltip": "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
                "default_val": "4",
                "min": 0,
                "max": 6
            },
            "restack": {
                "type": "bool",
                "tooltip": "<p>When set to False, only the predictions of estimators will be used as\ntraining data for the meta_model.</p>\n",
                "default_val": "False"
            },
            "choose_better": {
                "type": "bool",
                "tooltip": "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
                "default_val": "False"
            },
            "optimize": {
                "type": "string",
                "tooltip": "<p>Metric to compare for model selection when choose_better is True.</p>\n",
                "default_val": "R2"
            },
            "fit_kwargs": {
                "type": "dict",
                "tooltip": "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
                "default_val": "{} (empty dict)"
            },
            "groups": {
                "type": "string",
                "tooltip": "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
                "default_val": "None"
            },
            "verbose": {
                "type": "bool",
                "tooltip": "<p>Score grid is not printed when verbose is set to False.</p>\n",
                "default_val": "True"
            },
            "return_train_score": {
                "type": "bool",
                "tooltip": "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
                "default_val": "False"
            }
        },
        "ml_types": "classification regression",
        "code": "stack_models()",
        "default": {}
    },
    group_models: {
        options: {},
        code: ""
    }
}; 
 export default regressionSettings;
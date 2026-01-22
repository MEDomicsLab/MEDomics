var survivalAnalysisSettings = {
  split: {
    options: {
      train_size: {
        type: "float",
        tooltip: "<p><p>Proportion of the dataset to be used for training and validation. Should be\nbetween 0.0 and 1.0.</p>\n</p>",
        default_val: "0.7"
      },
      data_split_stratify: {
        type: "bool",
        tooltip: "<p><p>Controls stratification during \u2018train_test_split\u2019. When set to True, will\nstratify by target column. To stratify on any other columns, pass a list of\ncolumn names. Ignored when data_split_shuffle is False.</p>\n</p>",
        default_val: "False"
      },
      data_split_shuffle: {
        type: "bool",
        tooltip: "<p><p>When set to False, prevents shuffling of rows during \u2018train_test_split\u2019.</p>\n</p>",
        default_val: "True"
      }
    },
    code: "\ndef split_data(Dataset, node_settings):\n    # do yo things here\n    return Dataset1, Dataset2\n"
  },
  clean: {
    options: {
      imputation_type: {
        type: "str or None",
        tooltip: "<p><p>The type of imputation to use. Can be either \u2018simple\u2019 or \u2018iterative\u2019.\nIf None, no imputation of missing values is performed.</p>\n</p>",
        default_val: "simple"
      },
      normalize: {
        type: "bool",
        tooltip: "<p><p>When set to True, it transforms the features by scaling them to a given\nrange. Type of scaling is defined by the normalize_method parameter.</p>\n</p>",
        default_val: "False"
      },
      normalize_method: {
        type: "string",
        tooltip:
          "<p><p>Defines the method for scaling. By default, normalize method is set to \u2018zscore\u2019\nThe standard zscore is calculated as z = (x - u) / s. Ignored when normalize\nis not True. The other options are:</p>\n<ul >\n<li><p>minmax: scales and translates each feature individually such that it is in</p></li>\n</ul>\n<p>the range of 0 - 1.\n- maxabs: scales and translates each feature individually such that the\nmaximal absolute value of each feature will be 1.0. It does not\nshift/center the data, and thus does not destroy any sparsity.\n- robust: scales and translates each feature according to the Interquartile\nrange. When the dataset contains outliers, robust scaler often gives\nbetter results.</p>\n</p>",
        default_val: "zscore"
      },
      iterative_imputation_iters: {
        type: "int",
        tooltip: "<p><p>Number of iterations. Ignored when imputation_type=simple.</p>\n</p>",
        default_val: "5"
      },
      categorical_imputation: {
        type: "string",
        tooltip: "<p><p>Imputing strategy for categorical columns. Ignored when imputation_type= iterative. Choose from:</p>\n<blockquote>\n<div><ul >\n<li><p>\u201cdrop\u201d: Drop rows containing missing values.</p></li>\n<li><p>\u201cmode\u201d: Impute with most frequent value.</p></li>\n<li><p>str: Impute with provided string.</p></li>\n</ul>\n</div></blockquote>\n</p>",
        default_val: "mode"
      },
      categorical_iterative_imputer: {
        type: "str or sklearn estimator",
        tooltip: "<p><p>Regressor for iterative imputation of missing values in categorical features.\nIf None, it uses LGBClassifier. Ignored when imputation_type=simple.</p>\n</p>",
        default_val: "lightgbm"
      },
      numeric_imputation: {
        type: "int",
        tooltip:
          "<p><p>Imputing strategy for numerical columns. Ignored when imputation_type= iterative. Choose from:</p>\n<blockquote>\n<div><ul >\n<li><p>\u201cdrop\u201d: Drop rows containing missing values.</p></li>\n<li><p>\u201cmean\u201d: Impute with mean of column.</p></li>\n<li><p>\u201cmedian\u201d: Impute with median of column.</p></li>\n<li><p>\u201cmode\u201d: Impute with most frequent value.</p></li>\n<li><p>\u201cknn\u201d: Impute using a K-Nearest Neighbors approach.</p></li>\n<li><p>int or float: Impute with provided numerical value.</p></li>\n</ul>\n</div></blockquote>\n</p>",
        default_val: "mean"
      },
      numeric_iterative_imputer: {
        type: "str or sklearn estimator",
        tooltip: "<p><p>Regressor for iterative imputation of missing values in numeric features.\nIf None, it uses LGBClassifier. Ignored when imputation_type=simple.</p>\n</p>",
        default_val: "lightgbm"
      },
      transformation: {
        type: "bool",
        tooltip: "<p><p>When set to True, it applies the power transform to make data more Gaussian-like.\nType of transformation is defined by the transformation_method parameter.</p>\n</p>",
        default_val: "False"
      },
      transformation_method: {
        type: "string",
        tooltip: "<p><p>Defines the method for transformation. By default, the transformation method is\nset to \u2018yeo-johnson\u2019. The other available option for transformation is \u2018quantile\u2019.\nIgnored when transformation is not True.</p>\n</p>",
        default_val: "yeo-johnson"
      },
      pca: {
        type: "bool",
        tooltip: "<p><p>When set to True, dimensionality reduction is applied to project the data into\na lower dimensional space using the method defined in pca_method parameter.</p>\n</p>",
        default_val: "False"
      },
      pca_method: {
        type: "string",
        tooltip: "<p><dl >\n<dt>Method with which to apply PCA. Possible values are:</dt><dd><ul >\n<li><p>\u2018linear\u2019: Uses Singular Value  Decomposition.</p></li>\n<li><p>\u2018kernel\u2019: Dimensionality reduction through the use of RBF kernel.</p></li>\n<li><p>\u2018incremental\u2019: Similar to \u2018linear\u2019, but more efficient for large datasets.</p></li>\n</ul>\n</dd>\n</dl>\n</p>",
        default_val: "linear"
      },
      pca_components: {
        type: "int",
        tooltip:
          "<p><dl >\n<dt>Number of components to keep. This parameter is ignored when <cite>pca=False</cite>.</dt><dd><ul >\n<li><p>If None: All components are kept.</p></li>\n<li><p>If int: Absolute number of components.</p></li>\n<li><dl >\n<dt>If float: Such an amount that the variance that needs to be explained</dt><dd><p>is greater than the percentage specified by <cite>n_components</cite>.\nValue should lie between 0 and 1 (ony for pca_method=\u2019linear\u2019).</p>\n</dd>\n</dl>\n</li>\n<li><p>If \u201cmle\u201d: Minka\u2019s MLE is used to guess the dimension (ony for pca_method=\u2019linear\u2019).</p></li>\n</ul>\n</dd>\n</dl>\n</p>",
        default_val: "None"
      },
      remove_outliers: {
        type: "bool",
        tooltip: "<p><p>When set to True, outliers from the training data are removed using an\nIsolation Forest.</p>\n</p>",
        default_val: "False"
      },
      outliers_threshold: {
        type: "float",
        tooltip: "<p><p>The percentage of outliers to be removed from the dataset. Ignored\nwhen remove_outliers=False.</p>\n</p>",
        default_val: "0.05"
      },
      remove_multicollinearity: {
        type: "bool",
        tooltip: "<p><p>When set to True, features with the inter-correlations higher than\nthe defined threshold are removed. For each group, it removes all\nexcept the feature with the highest correlation to <cite>y</cite>.</p>\n</p>",
        default_val: "False"
      },
      multicollinearity_threshold: {
        type: "float",
        tooltip: "<p><p>Minimum absolute Pearson correlation to identify correlated\nfeatures. The default value removes equal columns. Ignored when\nremove_multicollinearity is not True.</p>\n</p>",
        default_val: "0.9"
      },
      polynomial_features: {
        type: "bool",
        tooltip: "<p><p>When set to True, new features are derived using existing numeric features.</p>\n</p>",
        default_val: "False"
      },
      polynomial_degree: {
        type: "int",
        tooltip: "<p><p>Degree of polynomial features. For example, if an input sample is two dimensional\nand of the form [a, b], the polynomial features with degree = 2 are:\n[1, a, b, a^2, ab, b^2]. Ignored when polynomial_features is not True.</p>\n</p>",
        default_val: "2"
      },
      feature_selection: {
        type: "bool",
        tooltip: "<p><p>When set to True, a subset of features is selected based on a feature\nimportance score determined by feature_selection_estimator.</p>\n</p>",
        default_val: "False"
      },
      feature_selection_estimator: {
        type: "str or sklearn estimator",
        tooltip: "<p><p>Classifier used to determine the feature importances. The\nestimator should have a <cite>feature_importances_</cite> or <cite>coef_</cite>\nattribute after fitting. If None, it uses LGBRegressor. This\nparameter is ignored when <cite>feature_selection_method=univariate</cite>.</p>\n</p>",
        default_val: "lightgbm"
      },
      feature_selection_method: {
        type: "string",
        tooltip: "<p><dl >\n<dt>Algorithm for feature selection. Choose from:</dt><dd><ul >\n<li><p>\u2018univariate\u2019: Uses sklearn\u2019s SelectKBest.</p></li>\n<li><p>\u2018classic\u2019: Uses sklearn\u2019s SelectFromModel.</p></li>\n<li><p>\u2018sequential\u2019: Uses sklearn\u2019s SequtnailFeatureSelector.</p></li>\n</ul>\n</dd>\n</dl>\n</p>",
        default_val: "classic"
      }
    },
    code: "\ndef clean_data(Dataset, node_settings):\n    # do yo things here\n    return Dataset_cleaned\n        "
  },
  dataset: {
    options: {
      data_func: {
        type: "Callable[[]",
        tooltip: "<p><p>The function that generate data (the dataframe-like input). This\nis useful when the dataset is large, and you need parallel operations\nsuch as compare_models. It can avoid boradcasting large dataset\nfrom driver to workers. Notice one and only one of data and\ndata_func must be set.</p>\n</p>",
        default_val: ""
      },
      test_data: {
        type: "dataframe-like or None",
        tooltip: "<p><p>If not None, test_data is used as a hold-out set and <cite>train_size</cite> parameter\nis ignored. The columns of data and test_data must match. If it\u2019s a pandas\ndataframe, the indices must match as well.</p>\n</p>",
        default_val: "None"
      },
      ordinal_features: {
        type: "dict",
        tooltip: "<p><p>Categorical features to be encoded ordinally. For example, a categorical\nfeature with \u2018low\u2019, \u2018medium\u2019, \u2018high\u2019 values where low &lt; medium &lt; high can\nbe passed as ordinal_features = {\u2018column_name\u2019 : [\u2018low\u2019, \u2018medium\u2019, \u2018high\u2019]}.</p>\n</p>",
        default_val: "None"
      },
      numeric_features: {
        type: "custom-list",
        tooltip: "<p><p>If the inferred data types are not correct, the numeric_features param can\nbe used to define the data types. It takes a list of strings with column\nnames that are numeric.</p>\n</p>",
        default_val: "None"
      },
      categorical_features: {
        type: "custom-list",
        tooltip: "<p><p>If the inferred data types are not correct, the categorical_features param\ncan be used to define the data types. It takes a list of strings with column\nnames that are categorical.</p>\n</p>",
        default_val: "None"
      },
      date_features: {
        type: "custom-list",
        tooltip: "<p><p>If the inferred data types are not correct, the date_features param can be\nused to overwrite the data types. It takes a list of strings with column\nnames that are DateTime.</p>\n</p>",
        default_val: "None"
      },
      text_features: {
        type: "custom-list",
        tooltip: "<p><p>Column names that contain a text corpus. If None, no text features are\nselected.</p>\n</p>",
        default_val: "None"
      },
      ignore_features: {
        type: "custom-list",
        tooltip: "<p><p>ignore_features param can be used to ignore features during preprocessing\nand model training. It takes a list of strings with column names that are\nto be ignored.</p>\n</p>",
        default_val: "None"
      },
      keep_features: {
        type: "custom-list",
        tooltip: "<p><p>keep_features param can be used to always keep specific features during\npreprocessing, i.e. these features are never dropped by any kind of\nfeature selection. It takes a list of strings with column names that are\nto be kept.</p>\n</p>",
        default_val: "None"
      },
      preprocess: {
        type: "bool",
        tooltip: "<p><p>When set to False, no transformations are applied except for train_test_split\nand custom transformations passed in custom_pipeline param. Data must be\nready for modeling (no missing values, no dates, categorical data encoding),\nwhen preprocess is set to False.</p>\n</p>",
        default_val: "True"
      },
      create_date_columns: {
        type: "custom-list",
        tooltip: "<p><p>Columns to create from the date features. Note that created features\nwith zero variance (e.g. the feature hour in a column that only contains\ndates) are ignored. Allowed values are datetime attributes from\n<cite>pandas.Series.dt</cite>. The datetime format of the feature is inferred\nautomatically from the first non NaN value.</p>\n</p>",
        default_val: "\u201cday\u201d, \u201cmonth\u201d, \u201cyear\u201d]"
      },
      text_features_method: {
        type: "string",
        tooltip: "<p><p>Method with which to embed the text features in the dataset. Choose\nbetween \u201cbow\u201d (Bag of Words - CountVectorizer) or \u201ctf-idf\u201d (TfidfVectorizer).\nBe aware that the sparse matrix output of the transformer is converted\ninternally to its full array. This can cause memory issues for large\ntext embeddings.</p>\n</p>",
        default_val: "\u201ctf-idf\u201d"
      },
      max_encoding_ohe: {
        type: "int",
        tooltip: "<p><p>Categorical columns with <cite>max_encoding_ohe</cite> or less unique values are\nencoded using OneHotEncoding. If more, the <cite>encoding_method</cite> estimator\nis used. Note that columns with exactly two classes are always encoded\nordinally. Set to below 0 to always use OneHotEncoding.</p>\n</p>",
        default_val: "5"
      },
      encoding_method: {
        type: "category-encoders estimator",
        tooltip: "<p><p>A <cite>category-encoders</cite> estimator to encode the categorical columns\nwith more than <cite>max_encoding_ohe</cite> unique values. If None,\n<cite>category_encoders.leave_one_out.LeaveOneOutEncoder</cite> is used.</p>\n</p>",
        default_val: "None"
      },
      rare_to_value: {
        type: "float or None",
        tooltip: "<p><p>Minimum fraction of category occurrences in a categorical column.\nIf a category is less frequent than <cite>rare_to_value * len(X)</cite>, it is\nreplaced with the string in <cite>rare_value</cite>. Use this parameter to group\nrare categories before encoding the column. If None, ignores this step.</p>\n</p>",
        default_val: "one"
      },
      rare_value: {
        type: "string",
        tooltip: "<p><p>Value with which to replace rare categories. Ignored when\nrare_to_value is None.</p>\n</p>",
        default_val: "rare\u201d"
      },
      low_variance_threshold: {
        type: "float or None",
        tooltip: "<p><p>Remove features with a training-set variance lower than the provided\nthreshold. The default is to keep all features with non-zero variance,\ni.e. remove the features that have the same value in all samples. If\nNone, skip this transformation step.</p>\n</p>",
        default_val: "0"
      },
      group_features: {
        type: "custom-list",
        tooltip: "<p><p>When the dataset contains features with related characteristics,\nreplace those fetaures with the following statistical properties\nof that group: min, max, mean, std, median and mode. The parameter\ntakes a list of feature names or a list of lists of feature names\nto specify multiple groups.</p>\n</p>",
        default_val: "None"
      },
      group_names: {
        type: "string",
        tooltip: "<p><p>Group names to be used when naming the new features. The length\nshould match with the number of groups specified in group_features.\nIf None, new features are named using the default form, e.g. group_1,\ngroup_2, etc\u2026 Ignored when group_features is None.</p>\n</p>",
        default_val: "None"
      },
      bin_numeric_features: {
        type: "custom-list",
        tooltip: "<p><p>To convert numeric features into categorical, bin_numeric_features parameter can\nbe used. It takes a list of strings with column names to be discretized. It does\nso by using \u2018sturges\u2019 rule to determine the number of clusters and then apply\nKMeans algorithm. Original values of the feature are then replaced by the\ncluster label.</p>\n</p>",
        default_val: "None"
      },
      outliers_method: {
        type: "string",
        tooltip: "<p><p>Method with which to remove outliers. Ignored when <cite>remove_outliers=False</cite>.\nPossible values are:</p>\n<blockquote>\n<div><ul >\n<li><p>\u2018iforest\u2019: Uses sklearn\u2019s IsolationForest.</p></li>\n<li><p>\u2018ee\u2019: Uses sklearn\u2019s EllipticEnvelope.</p></li>\n<li><p>\u2018lof\u2019: Uses sklearn\u2019s LocalOutlierFactor.</p></li>\n</ul>\n</div></blockquote>\n</p>",
        default_val: "\u201ciforest\u201d"
      },
      n_features_to_select: {
        type: "int",
        tooltip: "<p><p>The number of features to select. Note that this parameter doesn\u2019t\ntake features in ignore_features or keep_features into account\nwhen counting.</p>\n</p>",
        default_val: "10"
      },
      transform_target: {
        type: "bool",
        tooltip: "<p><p>When set to True, target variable is transformed using the method defined in\ntransform_target_method param. Target transformation is applied separately\nfrom feature transformations.</p>\n</p>",
        default_val: "False"
      },
      transform_target_method: {
        type: "string",
        tooltip: "<p><p>Defines the method for transformation. By default, the transformation method is\nset to \u2018yeo-johnson\u2019. The other available option for transformation is \u2018quantile\u2019.\nIgnored when transform_target is not True.</p>\n</p>",
        default_val: "yeo-johnson"
      },
      custom_pipeline: {
        type: "list of (str",
        tooltip: "<p><p>Addidiotnal custom transformers. If passed, they are applied to the\npipeline last, after all the build-in transformers.</p>\n</p>",
        default_val: "None"
      },
      custom_pipeline_position: {
        type: "int",
        tooltip: "<p><p>Position of the custom pipeline in the overal preprocessing pipeline.\nThe default value adds the custom pipeline last.</p>\n</p>",
        default_val: "-1"
      },
      fold_strategy: {
        type: "string",
        tooltip: '<p><p>Choice of cross validation strategy. Possible values are:</p>\n<ul >\n<li><p>\u2018kfold\u2019</p></li>\n<li><p>\u2018groupkfold\u2019</p></li>\n<li><p>\u2018timeseries\u2019</p></li>\n<li><p>a custom CV generator object compatible with scikit-learn.</p></li>\n</ul>\n<p>For groupkfold, column name must be passed in fold_groups parameter.\nExample: setup(fold_strategy="groupkfold", fold_groups="COLUMN_NAME")</p>\n</p>',
        default_val: "kfold"
      },
      fold: {
        type: "int",
        tooltip: "<p><p>Number of folds to be used in cross validation. Must be at least 2. This is\na global setting that can be over-written at function level by using fold\nparameter. Ignored when fold_strategy is a custom object.</p>\n</p>",
        default_val: "10"
      },
      fold_shuffle: {
        type: "bool",
        tooltip: "<p><p>Controls the shuffle parameter of CV. Only applicable when fold_strategy\nis \u2018kfold\u2019 or \u2018stratifiedkfold\u2019. Ignored when fold_strategy is a custom\nobject.</p>\n</p>",
        default_val: "False"
      },
      fold_groups: {
        type: "str or array-like",
        tooltip: "<p><p>Optional group labels when \u2018GroupKFold\u2019 is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in the training dataset. When string is passed, it is interpreted\nas the column name in the dataset containing group labels.</p>\n</p>",
        default_val: "None"
      },
      n_jobs: {
        type: "int",
        tooltip: "<p><p>The number of jobs to run in parallel (for functions that supports parallel\nprocessing) -1 means using all processors. To run all functions on single\nprocessor set n_jobs to None.</p>\n</p>",
        default_val: "-1"
      },
      use_gpu: {
        type: "list",
        tooltip:
          "<p><p>When set to True, it will use GPU for training with algorithms that support it,\nand fall back to CPU if they are unavailable. When set to \u2018force\u2019, it will only\nuse GPU-enabled algorithms and raise exceptions when they are unavailable. When\nFalse, all algorithms are trained using CPU only.</p>\n<p>GPU enabled algorithms:</p>\n<ul >\n<li><p>Extreme Gradient Boosting, requires no further installation</p></li>\n<li><p>CatBoost Classifier, requires no further installation</p></li>\n</ul>\n<p>(GPU is only enabled when data &gt; 50,000 rows)</p>\n<ul >\n<li><p>Light Gradient Boosting Machine, requires GPU installation</p></li>\n</ul>\n<p>https://lightgbm.readthedocs.io/en/latest/GPU-Tutorial.html</p>\n<ul >\n<li><p>Linear Regression, Lasso Regression, Ridge Regression, K Neighbors Regressor,</p></li>\n</ul>\n<p>Random Forest, Support Vector Regression, Elastic Net requires cuML &gt;= 0.15\nhttps://github.com/rapidsai/cuml</p>\n</p>",
        default_val: "False",
        choices: {
          False: "tooltip False",
          True: "tooltip True",
          force: "tooltip force"
        }
      },
      html: {
        type: "bool",
        tooltip: "<p><p>When set to False, prevents runtime display of monitor. This must be set to False\nwhen the environment does not support IPython. For example, command line terminal,\nDatabricks Notebook, Spyder and other similar IDEs.</p>\n</p>",
        default_val: "True"
      },
      session_id: {
        type: "int",
        tooltip: "<p><p>Controls the randomness of experiment. It is equivalent to \u2018random_state\u2019 in\nscikit-learn. When None, a pseudo random number is generated. This can be used\nfor later reproducibility of the entire experiment.</p>\n</p>",
        default_val: "None"
      },
      log_experiment: {
        type: "bool",
        tooltip: "<p><p>A (list of) PyCaret BaseLogger or str (one of \u2018mlflow\u2019, \u2018wandb\u2019)\ncorresponding to a logger to determine which experiment loggers to use.\nSetting to True will use just MLFlow.\nIf wandb (Weights &amp; Biases) is installed, will also log there.</p>\n</p>",
        default_val: "False"
      },
      system_log: {
        type: "bool or str or logging.Logger",
        tooltip: "<p><p>Whether to save the system logging file (as logs.log). If the input\nis a string, use that as the path to the logging file. If the input\nalready is a logger object, use that one instead.</p>\n</p>",
        default_val: "True"
      },
      experiment_name: {
        type: "string",
        tooltip: "<p><p>Name of the experiment for logging. Ignored when log_experiment is False.</p>\n</p>",
        default_val: "None"
      },
      experiment_custom_tags: {
        type: "dict",
        tooltip: "<p><p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n</p>",
        default_val: "None"
      },
      log_plots: {
        type: "bool",
        tooltip: "<p><p>When set to True, certain plots are logged automatically in the MLFlow server.\nTo change the type of plots to be logged, pass a list containing plot IDs. Refer\nto documentation of plot_model. Ignored when log_experiment is False.</p>\n</p>",
        default_val: "False"
      },
      log_profile: {
        type: "bool",
        tooltip: "<p><p>When set to True, data profile is logged on the MLflow server as a html file.\nIgnored when log_experiment is False.</p>\n</p>",
        default_val: "False"
      },
      log_data: {
        type: "bool",
        tooltip: "<p><p>When set to True, dataset is logged on the MLflow server as a csv file.\nIgnored when log_experiment is False.</p>\n</p>",
        default_val: "False"
      },
      engines: {
        type: "Optional[Dict[str",
        tooltip: "<p><p>The execution engines to use for the models in the form of a dict\nof <cite>model_id: engine</cite> - e.g. for Linear Regression (\u201clr\u201d, users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engines={\u201clr\u201d: \u201csklearnex\u201d}</cite></p>\n</p>",
        default_val: ""
      },
      verbose: {
        type: "bool",
        tooltip: "<p><p>When set to False, Information grid is not printed.</p>\n</p>",
        default_val: "True"
      },
      memory: {
        type: "string",
        tooltip: "<p><dl >\n<dt>Used to cache the fitted transformers of the pipeline.</dt><dd><p>If False: No caching is performed.\nIf True: A default temp directory is used.\nIf str: Path to the caching directory.</p>\n</dd>\n</dl>\n</p>",
        default_val: "rue"
      },
      profile: {
        type: "bool",
        tooltip: "<p><p>When set to True, an interactive EDA report is displayed.</p>\n</p>",
        default_val: "False"
      },
      profile_kwargs: {
        type: "dict",
        tooltip: "<p><p>Dictionary of arguments passed to the ProfileReport method used\nto create the EDA report. Ignored if profile is False.</p>\n</p>",
        default_val: "{} (empty dict)"
      },
      "time-point": {
        type: "string",
        default_val: "",
        tooltip: "<p>Time point relative to where analysis is performed</p>"
      },
      split_experiment_by_institutions: {
        type: "bool",
        default_val: "False",
        tooltip: "<p>Set this to true for analysis by institutions</p>"
      }
    },
    code: "\n        \n        ",
    default: {
      data: {
        type: "dataframe-like = None",
        tooltip: "<p><p>Data set with shape (n_samples, n_features), where n_samples is the\nnumber of samples and n_features is the number of features. If data\nis not a pandas dataframe, it\u2019s converted to one using default column\nnames.</p>\n</p>"
      },
      target: {
        type: "string",
        tooltip: "<p><p>If int or str, respectivcely index or name of the target column in data.\nThe default value selects the last column in the dataset. If sequence,\nit should have shape (n_samples,). The target can be either binary or\nmulticlass.</p>\n</p>"
      },
      files: {
        type: "string",
        tooltip: "<p>Specify path to csv file or to medomics folder.</p>"
      }
    }
  },
  optimize: {
    subNodes: ["tune_model", "ensemble_model", "blend_models", "stack_models"],
    options: {},
    code: "\ndef optimise_model(model, node_settings):\n    # do yo things here\n    return model_optimised\n        "
  },
  compare_models: {
    options: {
      include: {
        type: "list-multiple",
        tooltip: "<p><p>To train and evaluate select models, list containing model ID or scikit-learn\ncompatible object can be passed in include param. To see a list of all models\navailable in the model library use the models function.</p>\n</p>",
        default_val: "None",
        choices: {
          lr: "Linear Regression",
          lasso: "Lasso Regression",
          ridge: "Ridge Regression",
          en: "Elastic Net",
          lar: "Least Angle Regression",
          llar: "Lasso Least Angle Regression",
          omp: "Orthogonal Matching Pursuit",
          br: "Bayesian Ridge",
          ard: "Automatic Relevance Determination",
          par: "Passive Aggressive Regressor",
          ransac: "Random Sample Consensus",
          tr: "TheilSen Regressor",
          huber: "Huber Regressor",
          kr: "Kernel Ridge",
          svm: "Support Vector Regression",
          knn: "K Neighbors Regressor",
          dt: "Decision Tree Regressor",
          rf: "Random Forest Regressor",
          et: "Extra Trees Regressor",
          ada: "AdaBoost Regressor",
          gbr: "Gradient Boosting Regressor",
          mlp: "MLP Regressor",
          xgboost: "Extreme Gradient Boosting",
          lightgbm: "Light Gradient Boosting Machine",
          catboost: "CatBoost Regressor"
        }
      },
      exclude: {
        type: "custom-list",
        tooltip: "<p><p>To omit certain models from training and evaluation, pass a list containing\nmodel id in the exclude parameter. To see a list of all models available\nin the model library use the models function.</p>\n</p>",
        default_val: "None"
      },
      fold: {
        type: "int",
        tooltip: "<p><p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n</p>",
        default_val: "None"
      },
      round: {
        type: "int",
        tooltip: "<p><p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n</p>",
        default_val: "4"
      },
      cross_validation: {
        type: "bool",
        tooltip: "<p><p>When set to False, metrics are evaluated on holdout set. fold param\nis ignored when cross_validation is set to False.</p>\n</p>",
        default_val: "True"
      },
      sort: {
        type: "string",
        tooltip: "<p><p>The sort order of the score grid. It also accepts custom metrics that are\nadded through the add_metric function.</p>\n</p>",
        default_val: "R2"
      },
      n_select: {
        type: "int",
        tooltip: "<p><p>Number of top_n models to return. For example, to select top 3 models use\nn_select = 3.</p>\n</p>",
        default_val: "1"
      },
      budget_time: {
        type: "float",
        tooltip: "<p><p>If not None, will terminate execution of the function after budget_time\nminutes have passed and return results up to that point.</p>\n</p>",
        default_val: "None"
      },
      turbo: {
        type: "bool",
        tooltip: "<p><p>When set to True, it excludes estimators with longer training times. To\nsee which algorithms are excluded use the models function.</p>\n</p>",
        default_val: "True"
      },
      errors: {
        type: "string",
        tooltip: "<p><p>When set to \u2018ignore\u2019, will skip the model with exceptions and continue.\nIf \u2018raise\u2019, will break the function when exceptions are raised.</p>\n</p>",
        default_val: "ignore"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p><p>Dictionary of arguments passed to the fit method of the model.</p>\n</p>",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "str or array-like",
        tooltip: "<p><p>Optional group labels when \u2018GroupKFold\u2019 is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in the training dataset. When string is passed, it is interpreted\nas the column name in the dataset containing group labels.</p>\n</p>",
        default_val: "None"
      },
      engines: {
        type: "Optional[Dict[str",
        tooltip: "<p><p>The execution engines to use for the models in the form of a dict\nof <cite>model_id: engine</cite> - e.g. for Linear Regression (\u201clr\u201d, users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engines={\u201clr\u201d: \u201csklearnex\u201d}</cite></p>\n</p>",
        default_val: ""
      },
      verbose: {
        type: "bool",
        tooltip: "<p><p>Score grid is not printed when verbose is set to False.</p>\n</p>",
        default_val: "True"
      },
      parallel: {
        type: "pycaret.internal.parallel.parallel_backend.ParallelBackend",
        tooltip: "<p><p>A ParallelBackend instance. For example if you have a SparkSession session,\nyou can use FugueBackend(session) to make this function running using\nSpark. For more details, see\nFugueBackend</p>\n</p>",
        default_val: "None"
      }
    },
    code: "\ncompare_models(node_settings)\n        "
  },
  create_model: {
    options: {
      fold: {
        type: "int",
        tooltip: "<p><p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n</p>",
        default_val: "None"
      },
      round: {
        type: "int",
        tooltip: "<p><p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n</p>",
        default_val: "4"
      },
      cross_validation: {
        type: "bool",
        tooltip: "<p><p>When set to False, metrics are evaluated on holdout set. fold param\nis ignored when cross_validation is set to False.</p>\n</p>",
        default_val: "True"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p><p>Dictionary of arguments passed to the fit method of the model.</p>\n</p>",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "str or array-like",
        tooltip: "<p><p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n</p>",
        default_val: "None"
      },
      experiment_custom_tags: {
        type: "dict",
        tooltip: "<p><p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n</p>",
        default_val: "None"
      },
      engine: {
        type: "Optional[str] = None",
        tooltip: "<p><p>The execution engine to use for the model, e.g. for Linear Regression (\u201clr\u201d), users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engine=\u201dsklearnex\u201d</cite>.</p>\n</p>",
        default_val: ""
      },
      verbose: {
        type: "bool",
        tooltip: "<p><p>Score grid is not printed when verbose is set to False.</p>\n</p>",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip: "<p><p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n</p>",
        default_val: "False"
      }
    },
    code: "\ncreate_model(node_settings)\n        ",
    default: {}
  },
  analyze: {
    plot_model: {
      options: {
        plot: {
          type: "string",
          tooltip:
            "<p><p>List of available plots (ID - Name):</p>\n<ul >\n<li><p>\u2018pipeline\u2019 - Schematic drawing of the preprocessing pipeline</p></li>\n<li><p>\u2018residuals_interactive\u2019 - Interactive Residual plots</p></li>\n<li><p>\u2018residuals\u2019 - Residuals Plot</p></li>\n<li><p>\u2018error\u2019 - Prediction Error Plot</p></li>\n<li><p>\u2018cooks\u2019 - Cooks Distance Plot</p></li>\n<li><p>\u2018rfe\u2019 - Recursive Feat. Selection</p></li>\n<li><p>\u2018learning\u2019 - Learning Curve</p></li>\n<li><p>\u2018vc\u2019 - Validation Curve</p></li>\n<li><p>\u2018manifold\u2019 - Manifold Learning</p></li>\n<li><p>\u2018feature\u2019 - Feature Importance</p></li>\n<li><p>\u2018feature_all\u2019 - Feature Importance (All)</p></li>\n<li><p>\u2018parameter\u2019 - Model Hyperparameter</p></li>\n<li><p>\u2018tree\u2019 - Decision Tree</p></li>\n</ul>\n</p>",
          default_val: "residual"
        },
        scale: {
          type: "float",
          tooltip: "<p><p>The resolution scale of the figure.</p>\n</p>",
          default_val: "1"
        },
        save: {
          type: "bool",
          tooltip: "<p><p>When set to True, plot is saved in the current working directory.</p>\n</p>",
          default_val: "False"
        },
        fold: {
          type: "int",
          tooltip: "<p><p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n</p>",
          default_val: "None"
        },
        fit_kwargs: {
          type: "dict",
          tooltip: "<p><p>Dictionary of arguments passed to the fit method of the model.</p>\n</p>",
          default_val: "{} (empty dict)"
        },
        plot_kwargs: {
          type: "dict",
          tooltip: "<p><dl >\n<dt>Dictionary of arguments passed to the visualizer class.</dt><dd><ul >\n<li><p>pipeline: fontsize -&gt; int</p></li>\n</ul>\n</dd>\n</dl>\n</p>",
          default_val: "{} (empty dict)"
        },
        groups: {
          type: "str or array-like",
          tooltip: "<p><p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n</p>",
          default_val: "None"
        },
        use_train_data: {
          type: "bool",
          tooltip: "<p><p>When set to true, train data will be used for plots, instead\nof test data.</p>\n</p>",
          default_val: "False"
        },
        verbose: {
          type: "bool",
          tooltip: "<p><p>When set to False, backend's progress bar is not displayed.</p>\n</p>",
          default_val: "True"
        },
        display_format: {
          type: "string",
          tooltip: "<p><p>To display plots in Streamlit (https://www.streamlit.io/), set this to \u2018streamlit\u2019.\nCurrently, not all plots are supported.</p>\n</p>",
          default_val: "None"
        }
      },
      code: "plot_model()",
      default: {}
    },
    interpret_model: {
      options: {
        feature: {
          type: "string",
          tooltip: "<p><p>This parameter is only needed when plot = \u2018correlation\u2019 or \u2018pdp\u2019.\nBy default feature is set to None which means the first column of the\ndataset will be used as a variable. A feature parameter must be passed\nto change this.</p>\n</p>",
          default_val: "None"
        },
        observation: {
          type: "int",
          tooltip: "<p><p>This parameter only comes into effect when plot is set to \u2018reason\u2019. If no\nobservation number is provided, it will return an analysis of all observations\nwith the option to select the feature on x and y axes through drop down\ninteractivity. For analysis at the sample level, an observation parameter must\nbe passed with the index value of the observation in test / hold-out set.</p>\n</p>",
          default_val: "None"
        },
        use_train_data: {
          type: "bool",
          tooltip: "<p><p>When set to true, train data will be used for plots, instead\nof test data.</p>\n</p>",
          default_val: "False"
        },
        X_new_sample: {
          type: "pd.DataFrame",
          tooltip: "<p><p>Row from an out-of-sample dataframe (neither train nor test data) to be plotted.\nThe sample must have the same columns as the raw input train data, and it is transformed\nby the preprocessing pipeline automatically before plotting.</p>\n</p>",
          default_val: "None"
        },
        y_new_sample: {
          type: "pd.DataFrame",
          tooltip: "<p><p>Row from an out-of-sample dataframe (neither train nor test data) to be plotted.\nThe sample must have the same columns as the raw input label data, and it is transformed\nby the preprocessing pipeline automatically before plotting.</p>\n</p>",
          default_val: "None"
        },
        save: {
          type: "string or bool",
          tooltip: "<p><p>When set to True, Plot is saved as a \u2018png\u2019 file in current working directory.\nWhen a path destination is given, Plot is saved as a \u2018png\u2019 file the given path to the directory of choice.</p>\n</p>",
          default_val: "False"
        }
      },
      code: "interpret_model()",
      default: {}
    },
    dashboard: {
      options: {
        display_format: {
          type: "string",
          tooltip: "<p><p>Render mode for the dashboard. The default is set to dash which will\nrender a dashboard in browser. There are four possible options:</p>\n<ul >\n<li><p>\u2018dash\u2019 - displays the dashboard in browser</p></li>\n<li><p>\u2018inline\u2019 - displays the dashboard in the jupyter notebook cell.</p></li>\n<li><p>\u2018jupyterlab\u2019 - displays the dashboard in jupyterlab pane.</p></li>\n<li><p>\u2018external\u2019 - displays the dashboard in a separate tab. (use in Colab)</p></li>\n</ul>\n</p>",
          default_val: "dash"
        },
        dashboard_kwargs: {
          type: "dict",
          tooltip: "<p><p>Dictionary of arguments passed to the ExplainerDashboard class.</p>\n</p>",
          default_val: "{} (empty dict)"
        },
        run_kwargs: {
          type: "dict",
          tooltip: "<p><p>Dictionary of arguments passed to the run method of ExplainerDashboard.</p>\n</p>",
          default_val: "{} (empty dict)"
        }
      },
      code: "dashboard()",
      default: {}
    }
  },
  deploy: {
    predict_model: {
      options: {
        drift_report: {
          type: "bool",
          tooltip: "<p><p>When set to True, interactive drift report is generated on test set\nwith the evidently library.</p>\n</p>",
          default_val: "False"
        },
        round: {
          type: "int",
          tooltip: "<p><p>Number of decimal places to round predictions to.</p>\n</p>",
          default_val: "4"
        },
        verbose: {
          type: "bool",
          tooltip: "<p><p>When set to False, holdout score grid is not printed.</p>\n</p>",
          default_val: "True"
        }
      },
      code: "predict_model()",
      default: {}
    },
    finalize_model: {
      options: {
        fit_kwargs: {
          type: "dict",
          tooltip: "<p><p>Dictionary of arguments passed to the fit method of the model.</p>\n</p>",
          default_val: "{} (empty dict)"
        },
        groups: {
          type: "str or array-like",
          tooltip: "<p><p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n</p>",
          default_val: "None"
        },
        experiment_custom_tags: {
          type: "dict",
          tooltip: "<p><p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified if\nnot) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n</p>",
          default_val: "None"
        }
      },
      code: "finalize_model()",
      default: {}
    },
    save_model: {
      options: {
        model_only: {
          type: "bool",
          tooltip: "<p><p>When set to True, only trained model object is saved instead of the\nentire pipeline.</p>\n</p>",
          default_val: "False"
        },
        verbose: {
          type: "bool",
          tooltip: "<p><p>Success message is not printed when verbose is set to False.</p>\n</p>",
          default_val: "True"
        }
      },
      code: "save_model()",
      default: {
        model_name: {
          type: "string",
          tooltip: "<p><p>Name of the model.</p>\n</p>"
        }
      }
    },
    deploy_model: {
      options: {
        platform: {
          type: "string",
          tooltip: "<p><p>Name of the platform. Currently supported platforms: \u2018aws\u2019, \u2018gcp\u2019 and \u2018azure\u2019.</p>\n</p>",
          default_val: "aws"
        }
      },
      code: "deploy_model()",
      default: {
        "Amazon Web Service (AWS) users": {
          type: "",
          tooltip: "<p><p>To deploy a model on AWS S3 (\u2018aws\u2019), the credentials have to be passed. The easiest way is to use environment\nvariables in your local environment. Following information from the IAM portal of amazon console account\nare required:</p>\n<ul >\n<li><p>AWS Access Key ID</p></li>\n<li><p>AWS Secret Key Access</p></li>\n</ul>\n<p>More info: https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#environment-variables</p>\n</p>"
        },
        "Google Cloud Platform (GCP) users": {
          type: "",
          tooltip: "<p><p>To deploy a model on Google Cloud Platform (\u2018gcp\u2019), project must be created\nusing command line or GCP console. Once project is created, you must create\na service account and download the service account key as a JSON file to set\nenvironment variables in your local environment.</p>\n<p>More info: https://cloud.google.com/docs/authentication/production</p>\n</p>"
        },
        "Microsoft Azure (Azure) users": {
          type: "",
          tooltip: "<p><p>To deploy a model on Microsoft Azure (\u2018azure\u2019), environment variables for connection\nstring must be set in your local environment. Go to settings of storage account on\nAzure portal to access the connection string required.</p>\n<ul >\n<li><p>AZURE_STORAGE_CONNECTION_STRING (required as environment variable)</p></li>\n</ul>\n<p>More info: https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-python?toc=%2Fpython%2Fazure%2FTOC.json</p>\n</p>"
        },
        model_name: {
          type: "string",
          tooltip: "<p><p>Name of model.</p>\n</p>"
        },
        authentication: {
          type: "dict",
          tooltip: "<p><p>Dictionary of applicable authentication tokens.</p>\n<p>When platform = \u2018aws\u2019:\n{\u2018bucket\u2019 : \u2018S3-bucket-name\u2019, \u2018path\u2019: (optional) folder name under the bucket}</p>\n<p>When platform = \u2018gcp\u2019:\n{\u2018project\u2019: \u2018gcp-project-name\u2019, \u2018bucket\u2019 : \u2018gcp-bucket-name\u2019}</p>\n<p>When platform = \u2018azure\u2019:\n{\u2018container\u2019: \u2018azure-container-name\u2019}</p>\n</p>"
        }
      }
    }
  },
  tune_model: {
    options: {
      fold: {
        type: "int",
        tooltip: "<p><p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n</p>",
        default_val: "None"
      },
      round: {
        type: "int",
        tooltip: "<p><p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n</p>",
        default_val: "4"
      },
      n_iter: {
        type: "int",
        tooltip: "<p><p>Number of iterations in the grid search. Increasing \u2018n_iter\u2019 may improve\nmodel performance but also increases the training time.</p>\n</p>",
        default_val: "10"
      },
      custom_grid: {
        type: "dict",
        tooltip: "<p><p>To define custom search space for hyperparameters, pass a dictionary with\nparameter name and values to be iterated. Custom grids must be in a format\nsupported by the defined search_library.</p>\n</p>",
        default_val: "None"
      },
      optimize: {
        type: "string",
        tooltip: "<p><p>Metric name to be evaluated for hyperparameter tuning. It also accepts custom\nmetrics that are added through the add_metric function.</p>\n</p>",
        default_val: "R2"
      },
      custom_scorer: {
        type: "object",
        tooltip: "<p><p>custom scoring strategy can be passed to tune hyperparameters of the model.\nIt must be created using sklearn.make_scorer. It is equivalent of adding\ncustom metric using the add_metric function and passing the name of the\ncustom metric in the optimize parameter.\nWill be deprecated in future.</p>\n</p>",
        default_val: "None"
      },
      search_library: {
        type: "string",
        tooltip:
          "<p><p>The search library used for tuning hyperparameters. Possible values:</p>\n<ul >\n<li><dl >\n<dt>\u2018scikit-learn\u2019 - default, requires no further installation</dt><dd><p>https://github.com/scikit-learn/scikit-learn</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018scikit-optimize\u2019 - pip install scikit-optimize</dt><dd><p>https://scikit-optimize.github.io/stable/</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018tune-sklearn\u2019 - pip install tune-sklearn ray[tune]</dt><dd><p>https://github.com/ray-project/tune-sklearn</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018optuna\u2019 - pip install optuna</dt><dd><p>https://optuna.org/</p>\n</dd>\n</dl>\n</li>\n</ul>\n</p>",
        default_val: "scikit-learn"
      },
      search_algorithm: {
        type: "string",
        tooltip:
          "<p><p>The search algorithm depends on the search_library parameter.\nSome search algorithms require additional libraries to be installed.\nIf None, will use search library-specific default algorithm.</p>\n<ul >\n<li><dl >\n<dt>\u2018scikit-learn\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : random grid search (default)</p></li>\n<li><p>\u2018grid\u2019 : grid search</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018scikit-optimize\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018bayesian\u2019 : Bayesian search (default)</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018tune-sklearn\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : random grid search (default)</p></li>\n<li><p>\u2018grid\u2019 : grid search</p></li>\n<li><p>\u2018bayesian\u2019 : pip install scikit-optimize</p></li>\n<li><p>\u2018hyperopt\u2019 : pip install hyperopt</p></li>\n<li><p>\u2018optuna\u2019 : pip install optuna</p></li>\n<li><p>\u2018bohb\u2019 : pip install hpbandster ConfigSpace</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018optuna\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : randomized search</p></li>\n<li><p>\u2018tpe\u2019 : Tree-structured Parzen Estimator search (default)</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n</ul>\n</p>",
        default_val: "None"
      },
      early_stopping: {
        type: "bool or str or object",
        tooltip:
          "<p><p>Use early stopping to stop fitting to a hyperparameter configuration\nif it performs poorly. Ignored when search_library is scikit-learn,\nor if the estimator does not have \u2018partial_fit\u2019 attribute. If False or\nNone, early stopping will not be used. Can be either an object accepted\nby the search library or one of the following:</p>\n<ul >\n<li><p>\u2018asha\u2019 for Asynchronous Successive Halving Algorithm</p></li>\n<li><p>\u2018hyperband\u2019 for Hyperband</p></li>\n<li><p>\u2018median\u2019 for Median Stopping Rule</p></li>\n<li><p>If False or None, early stopping will not be used.</p></li>\n</ul>\n</p>",
        default_val: "False"
      },
      early_stopping_max_iters: {
        type: "int",
        tooltip: "<p><p>Maximum number of epochs to run for each sampled configuration.\nIgnored if early_stopping is False or None.</p>\n</p>",
        default_val: "10"
      },
      choose_better: {
        type: "bool",
        tooltip: "<p><p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n</p>",
        default_val: "True"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p><p>Dictionary of arguments passed to the fit method of the tuner.</p>\n</p>",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "str or array-like",
        tooltip: "<p><p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n</p>",
        default_val: "None"
      },
      return_tuner: {
        type: "bool",
        tooltip: "<p><p>When set to True, will return a tuple of (model, tuner_object).</p>\n</p>",
        default_val: "False"
      },
      verbose: {
        type: "bool",
        tooltip: "<p><p>Score grid is not printed when verbose is set to False.</p>\n</p>",
        default_val: "True"
      },
      tuner_verbose: {
        type: "bool or in",
        tooltip: "<p><p>If True or above 0, will print messages from the tuner. Higher values\nprint more messages. Ignored when verbose param is False.</p>\n</p>",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip: "<p><p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n</p>",
        default_val: "False"
      }
    },
    ml_types: "classification regression survival_analysis",
    code: "tune_model()",
    default: {}
  },
  ensemble_model: {
    options: {
      method: {
        type: "string",
        tooltip: "<p><p>Method for ensembling base estimator. It can be \u2018Bagging\u2019 or \u2018Boosting\u2019.</p>\n</p>",
        default_val: "Bagging"
      },
      fold: {
        type: "int",
        tooltip: "<p><p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n</p>",
        default_val: "None"
      },
      n_estimators: {
        type: "int",
        tooltip: "<p><p>The number of base estimators in the ensemble. In case of perfect fit, the\nlearning procedure is stopped early.</p>\n</p>",
        default_val: "10"
      },
      round: {
        type: "int",
        tooltip: "<p><p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n</p>",
        default_val: "4"
      },
      choose_better: {
        type: "bool",
        tooltip: "<p><p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n</p>",
        default_val: "False"
      },
      optimize: {
        type: "string",
        tooltip: "<p><p>Metric to compare for model selection when choose_better is True.</p>\n</p>",
        default_val: "R2"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p><p>Dictionary of arguments passed to the fit method of the model.</p>\n</p>",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "str or array-like",
        tooltip: "<p><p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n</p>",
        default_val: "None"
      }
    },
    ml_types: "classification regression",
    code: "ensemble_model()",
    default: {}
  },
  blend_models: {
    options: {
      fold: {
        type: "int",
        tooltip: "<p><p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n</p>",
        default_val: "None"
      },
      round: {
        type: "int",
        tooltip: "<p><p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n</p>",
        default_val: "4"
      },
      choose_better: {
        type: "bool",
        tooltip: "<p><p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n</p>",
        default_val: "False"
      },
      optimize: {
        type: "string",
        tooltip: "<p><p>Metric to compare for model selection when choose_better is True.</p>\n</p>",
        default_val: "R2"
      },
      weights: {
        type: "custom-list",
        tooltip: "<p><p>Sequence of weights (float or int) to weight the occurrences of predicted class\nlabels (hard voting) or class probabilities before averaging (soft voting). Uses\nuniform weights when None.</p>\n</p>",
        default_val: "None"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p><p>Dictionary of arguments passed to the fit method of the model.</p>\n</p>",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "str or array-like",
        tooltip: "<p><p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n</p>",
        default_val: "None"
      },
      verbose: {
        type: "bool",
        tooltip: "<p><p>Score grid is not printed when verbose is set to False.</p>\n</p>",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip: "<p><p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n</p>",
        default_val: "False"
      }
    },
    ml_types: "classification regression",
    code: "blend_models()",
    default: {
      estimator_list: {
        type: "list of scikit-learn compatible objects",
        tooltip: "<p><p>List of trained model objects</p>\n</p>"
      }
    }
  },
  stack_models: {
    options: {
      meta_model: {
        type: "list",
        tooltip: "<p><p>When None, Linear Regression is trained as a meta model.</p>\n</p>",
        default_val: "None",
        choices: {
          lr: "Linear Regression",
          lasso: "Lasso Regression",
          ridge: "Ridge Regression",
          en: "Elastic Net",
          lar: "Least Angle Regression",
          llar: "Lasso Least Angle Regression",
          omp: "Orthogonal Matching Pursuit",
          br: "Bayesian Ridge",
          ard: "Automatic Relevance Determination",
          par: "Passive Aggressive Regressor",
          ransac: "Random Sample Consensus",
          tr: "TheilSen Regressor",
          huber: "Huber Regressor",
          kr: "Kernel Ridge",
          svm: "Support Vector Regression",
          knn: "K Neighbors Regressor",
          dt: "Decision Tree Regressor",
          rf: "Random Forest Regressor",
          et: "Extra Trees Regressor",
          ada: "AdaBoost Regressor",
          gbr: "Gradient Boosting Regressor",
          mlp: "MLP Regressor",
          xgboost: "Extreme Gradient Boosting",
          lightgbm: "Light Gradient Boosting Machine",
          catboost: "CatBoost Regressor"
        }
      },
      meta_model_fold: {
        type: "integer or scikit-learn compatible CV generator",
        tooltip: "<p><p>Controls internal cross-validation. Can be an integer or a scikit-learn\nCV generator. If set to an integer, will use (Stratifed)KFold CV with\nthat many folds. See scikit-learn documentation on Stacking for\nmore details.</p>\n</p>",
        default_val: "5"
      },
      fold: {
        type: "int",
        tooltip: "<p><p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n</p>",
        default_val: "None"
      },
      round: {
        type: "int",
        tooltip: "<p><p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n</p>",
        default_val: "4"
      },
      restack: {
        type: "bool",
        tooltip: "<p><p>When set to False, only the predictions of estimators will be used as\ntraining data for the meta_model.</p>\n</p>",
        default_val: "False"
      },
      choose_better: {
        type: "bool",
        tooltip: "<p><p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n</p>",
        default_val: "False"
      },
      optimize: {
        type: "string",
        tooltip: "<p><p>Metric to compare for model selection when choose_better is True.</p>\n</p>",
        default_val: "R2"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p><p>Dictionary of arguments passed to the fit method of the model.</p>\n</p>",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "str or array-like",
        tooltip: "<p><p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n</p>",
        default_val: "None"
      },
      verbose: {
        type: "bool",
        tooltip: "<p><p>Score grid is not printed when verbose is set to False.</p>\n</p>",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip: "<p><p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n</p>",
        default_val: "False"
      }
    },
    ml_types: "classification regression",
    code: "stack_models()",
    default: {
      estimator_list: {
        type: "list of scikit-learn compatible objects",
        tooltip: "<p><p>List of trained model objects</p>\n</p>"
      }
    }
  },
  model: {
    lr: {
      options: {},
      code: "lr"
    },
    lasso: {
      options: {},
      code: "lasso"
    },
    ridge: {
      options: {},
      code: "ridge"
    },
    en: {
      options: {},
      code: "en"
    },
    lar: {
      options: {},
      code: "lar"
    },
    llar: {
      options: {},
      code: "llar"
    },
    omp: {
      options: {},
      code: "omp"
    },
    br: {
      options: {},
      code: "br"
    },
    ard: {
      options: {},
      code: "ard"
    },
    par: {
      options: {},
      code: "par"
    },
    ransac: {
      options: {},
      code: "ransac"
    },
    tr: {
      options: {},
      code: "tr"
    },
    huber: {
      options: {},
      code: "huber"
    },
    kr: {
      options: {},
      code: "kr"
    },
    svm: {
      options: {},
      code: "svm"
    },
    knn: {
      options: {},
      code: "knn"
    },
    dt: {
      options: {},
      code: "dt"
    },
    rf: {
      options: {},
      code: "rf"
    },
    et: {
      options: {},
      code: "et"
    },
    ada: {
      options: {},
      code: "ada"
    },
    gbr: {
      options: {},
      code: "gbr"
    },
    mlp: {
      options: {},
      code: "mlp"
    },
    xgboost: {
      options: {},
      code: "xgboost"
    },
    lightgbm: {
      options: {},
      code: "lightgbm"
    },
    catboost: {
      options: {},
      code: "catboost"
    }
  }
}

export default survivalAnalysisSettings

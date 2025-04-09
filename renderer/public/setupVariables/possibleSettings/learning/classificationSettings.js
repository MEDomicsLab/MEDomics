/* eslint-disable */
const classificationSettings = {
  split: {
    global: {
      n_iterations: {
        type: "int",
        tooltip: "Number of repetitions for the whole experiment.",
        default_val: 1,
        min: 1,
        max: 50
      },
      shuffle: {
        type: "bool",
        tooltip: "Whether to shuffle each class's samples before splitting into batches. Note that the samples within each split will not be shuffled.",
        default_val: "True"
      },
      random_state: {
        type: "int",
        tooltip: "Seed used to ensure reproducibility of splits.",
        default_val: 42,
        min: 1
      }
    },
    outer_split_type: {
      type: "list",
      tooltip: "Select the method for the Outer Split.\nThis split is optional and serves for external validation (generalization assessment).",
      default_val: "cross_validation",
      choices: {
        random_sub_sampling: "Random Sub-Sampling",
        cross_validation: "Cross-Validation",
        bootstrapping: "Bootstrapping",
        user_defined: "User-Defined"
      }
    },
    inner_split_type: {
      type: "list",
      tooltip: "Select the method for the Inner Split.\nThis split is optional and used mainly for model tuning (internal validation).\nIf left empty, PyCaret will automatically apply its default.",
      default_val: "cross_validation",
      choices: {
        random_sub_sampling: "Random Sub-Sampling",
        cross_validation: "Cross-Validation",
        bootstrapping: "Bootstrapping",
        user_defined: "User-Defined"
      }
    },
    outer: {
      random_sub_sampling: {
        test_size: {
          type: "float",
          tooltip: "Proportion of data to allocate to the test set (e.g., 0.2 = 20%).",
          default_val: 0.2,
          min: 0.1,
          max: 0.99
        },
        stratify: {
          type: "bool",
          tooltip: "Preserve the distribution of classes during splitting.",
          default_val: "False"
        }
      },
      cross_validation: {
        num_folds: {
          type: "int",
          tooltip: "Number of folds for Outer cross-validation.",
          default_val: 5,
          min: 2,
          max: 20
        },
        stratify: {
          type: "bool",
          tooltip: "Preserve the distribution of classes during Inner splitting.",
          default_val: "False"
        }
      },
      bootstrapping: {
        use_bootstrap_632: {
          type: "bool",
          tooltip: "When enabled, applies the 0.632 correction to combine in-bag and out-of-bag error estimates.",
          default_val: "True"
        },
        train_size: {
          type: "float",
          tooltip: "Proportion of the dataset to sample with replacement. Ignored if 0.632 is selected.",
          default_val: 0.632,
          min: 0.1,
          max: 0.99,
        }
      },
      user_defined: {
        train_indices: {
          type: "string",
          tooltip: "Custom list of training indices (comma seperated integers: [1, 2, 3, ...]).",
          default_val: "[]"
        },
        test_indices: {
          type: "string",
          tooltip: "Custom list of testing indices (comma seperated integers: [101, 102, 103, ...]).",
          default_val: "[]"
        }
      }
    },
    inner: {
      random_sub_sampling: {
        test_size: {
          type: "float",
          tooltip: "Proportion of data to allocate to the Inner test set.",
          default_val: 0.2,
          min: 0.1,
          max: 0.99
        },
        stratify: {
          type: "bool",
          tooltip: "Preserve the distribution of classes during Inner splitting.",
          default_val: "False"
        }
      },
      cross_validation: {
        num_folds: {
          type: "int",
          tooltip: "Number of folds for Inner cross-validation.",
          default_val: 5,
          min: 2,
          max: 20
        },
        stratify: {
          type: "bool",
          tooltip: "Preserve the distribution of classes during Inner splitting.",
          default_val: "False"
        }
      },
      bootstrapping: {
          use_bootstrap_632: {
          type: "bool",
          tooltip: "When enabled, applies the 0.632 correction to combine in-bag and out-of-bag error estimates.",
          default_val: "True"
        },
        train_size: {
          type: "float",
          tooltip: "Proportion of the dataset to sample with replacement. Ignored if 0.632 is selected.",
          default_val: 0.632,
          min: 0.1,
          max: 0.99,
        }
      },
      user_defined: {
        train_indices: {
          type: "json",
          tooltip: "Custom list of training indices (comma seperated integers: [1, 2, 3, ...]).",
          default_val: "[]"
        },
        test_indices: {
          type: "json",
          tooltip: "Custom list of testing indices (comma seperated integers: [101, 102, 103, ...]).",
          default_val: "[]"
        }
      }
    }
  },
  clean: {
    options: {
      imputation_type: {
        type: "string",
        tooltip: "<p>The type of imputation to use. Can be either \u2018simple\u2019 or \u2018iterative\u2019.\nIf None, no imputation of missing values is performed.</p>\n",
        default_val: "simple"
      },
      normalize: {
        type: "bool",
        tooltip: "<p>When set to True, it transforms the features by scaling them to a given\nrange. Type of scaling is defined by the normalize_method parameter.</p>\n",
        default_val: "False"
      },
      normalize_method: {
        type: "string",
        tooltip:
          "<p>Defines the method for scaling. By default, normalize method is set to \u2018zscore\u2019\nThe standard zscore is calculated as z = (x - u) / s. Ignored when normalize\nis not True. The other options are:</p>\n<ul >\n<li><p>minmax: scales and translates each feature individually such that it is in</p></li>\n</ul>\n<p>the range of 0 - 1.\n- maxabs: scales and translates each feature individually such that the\nmaximal absolute value of each feature will be 1.0. It does not\nshift/center the data, and thus does not destroy any sparsity.\n- robust: scales and translates each feature according to the Interquartile\nrange. When the dataset contains outliers, robust scaler often gives\nbetter results.</p>\n",
        default_val: "zscore"
      },
      iterative_imputation_iters: {
        type: "int",
        tooltip: "<p>Number of iterations. Ignored when imputation_type=simple.</p>\n",
        default_val: "5",
        min: 1,
        max: 100
      },
      categorical_imputation: {
        type: "string",
        tooltip:
          "<p>Imputing strategy for categorical columns. Ignored when imputation_type= iterative. Choose from:</p>\n<blockquote>\n<div><ul >\n<li><p>\u201cdrop\u201d: Drop rows containing missing values.</p></li>\n<li><p>\u201cmode\u201d: Impute with most frequent value.</p></li>\n<li><p>str: Impute with provided string.</p></li>\n</ul>\n</div></blockquote>\n",
        default_val: "mode"
      },
      categorical_iterative_imputer: {
        type: "string",
        tooltip: "<p>Regressor for iterative imputation of missing values in categorical features.\nIf None, it uses LGBClassifier. Ignored when imputation_type=simple.</p>\n",
        default_val: "lightgbm"
      },
      numeric_imputation: {
        type: "list",
        tooltip:
          "<p>Imputing strategy for numerical columns. Ignored when imputation_type= iterative. Choose from:</p>\n<blockquote>\n<div><ul >\n<li><p>\u201cdrop\u201d: Drop rows containing missing values.</p></li>\n<li><p>\u201cmean\u201d: Impute with mean of column.</p></li>\n<li><p>\u201cmedian\u201d: Impute with median of column.</p></li>\n<li><p>\u201cmode\u201d: Impute with most frequent value.</p></li>\n<li><p>\u201cknn\u201d: Impute using a K-Nearest Neighbors approach.</p></li>\n<li><p>int or float: Impute with provided numerical value.</p></li>\n</ul>\n</div></blockquote>\n",
        default_val: "mean",
        choices: {
          drop: "Drop rows containing missing values",
          mean: "Impute with mean of column",
          median: "Impute with median of column",
          mode: "Impute with most frequent value",
          knn: "Impute using a K-Nearest Neighbors approach"
        }
      },
      numeric_iterative_imputer: {
        type: "string",
        tooltip: "<p>Regressor for iterative imputation of missing values in numeric features.\nIf None, it uses LGBClassifier. Ignored when imputation_type=simple.</p>\n",
        default_val: "lightgbm"
      },
      transformation: {
        type: "bool",
        tooltip: "<p>When set to True, it applies the power transform to make data more Gaussian-like.\nType of transformation is defined by the transformation_method parameter.</p>\n",
        default_val: "False"
      },
      transformation_method: {
        type: "string",
        tooltip:
          "<p>Defines the method for transformation. By default, the transformation method is\nset to \u2018yeo-johnson\u2019. The other available option for transformation is \u2018quantile\u2019.\nIgnored when transformation is not True.</p>\n",
        default_val: "yeo-johnson"
      },
      pca: {
        type: "bool",
        tooltip: "<p>When set to True, dimensionality reduction is applied to project the data into\na lower dimensional space using the method defined in pca_method parameter.</p>\n",
        default_val: "False"
      },
      pca_method: {
        type: "string",
        tooltip:
          "<dl >\n<dt>Method with which to apply PCA. Possible values are:</dt><dd><ul >\n<li><p>\u2018linear\u2019: Uses Singular Value  Decomposition.</p></li>\n<li><p>\u2018kernel\u2019: Dimensionality reduction through the use of RBF kernel.</p></li>\n<li><p>\u2018incremental\u2019: Similar to \u2018linear\u2019, but more efficient for large datasets.</p></li>\n</ul>\n</dd>\n</dl>\n",
        default_val: "linear"
      },
      pca_components: {
        type: "int-float-str",
        tooltip:
          "<dl >\n<dt>Number of components to keep. This parameter is ignored when <cite>pca=False</cite>.</dt><dd><ul >\n<li><p>If None: All components are kept.</p></li>\n<li><p>If int: Absolute number of components.</p></li>\n<li><dl >\n<dt>If float: Such an amount that the variance that needs to be explained</dt><dd><p>is greater than the percentage specified by <cite>n_components</cite>.\nValue should lie between 0 and 1 (ony for pca_method=\u2019linear\u2019).</p>\n</dd>\n</dl>\n</li>\n<li><p>If \u201cmle\u201d: Minka\u2019s MLE is used to guess the dimension (ony for pca_method=\u2019linear\u2019).</p></li>\n</ul>\n</dd>\n</dl>\n",
        default_val: "None"
      },
      remove_outliers: {
        type: "bool",
        tooltip: "<p>When set to True, outliers from the training data are removed using an\nIsolation Forest.</p>\n",
        default_val: "False"
      },
      outliers_threshold: {
        type: "float",
        tooltip: "<p>The percentage of outliers to be removed from the dataset. Ignored\nwhen remove_outliers=False.</p>\n",
        default_val: "0.05",
        min: 0.0,
        max: 1.0
      },
      remove_multicollinearity: {
        type: "bool",
        tooltip:
          "<p>When set to True, features with the inter-correlations higher than\nthe defined threshold are removed. For each group, it removes all\nexcept the feature with the highest correlation to <cite>y</cite>.</p>\n",
        default_val: "False"
      },
      multicollinearity_threshold: {
        type: "float",
        tooltip: "<p>Minimum absolute Pearson correlation to identify correlated\nfeatures. The default value removes equal columns. Ignored when\nremove_multicollinearity is not True.</p>\n",
        default_val: "0.9",
        min: 0.0,
        max: 1.0 
      },
      polynomial_features: {
        type: "bool",
        tooltip: "<p>When set to True, new features are derived using existing numeric features.</p>\n",
        default_val: "False"
      },
      polynomial_degree: {
        type: "int",
        tooltip:
          "<p>Degree of polynomial features. For example, if an input sample is two dimensional\nand of the form [a, b], the polynomial features with degree = 2 are:\n[1, a, b, a^2, ab, b^2]. Ignored when polynomial_features is not True.</p>\n",
        default_val: "2",
        min: 1,
        max: 5
      },
      feature_selection: {
        type: "bool",
        tooltip: "<p>When set to True, a subset of features is selected based on a feature\nimportance score determined by feature_selection_estimator.</p>\n",
        default_val: "False"
      },
      feature_selection_estimator: {
        type: "string",
        tooltip:
          "<p>Classifier used to determine the feature importances. The\nestimator should have a <cite>feature_importances_</cite> or <cite>coef_</cite>\nattribute after fitting. If None, it uses LGBClassifier. This\nparameter is ignored when <cite>feature_selection_method=univariate</cite>.</p>\n",
        default_val: "lightgbm"
      },
      feature_selection_method: {
        type: "string",
        tooltip:
          "<dl >\n<dt>Algorithm for feature selection. Choose from:</dt><dd><ul >\n<li><p>\u2018univariate\u2019: Uses sklearn\u2019s SelectKBest.</p></li>\n<li><p>\u2018classic\u2019: Uses sklearn\u2019s SelectFromModel.</p></li>\n<li><p>\u2018sequential\u2019: Uses sklearn\u2019s SequentialFeatureSelector.</p></li>\n</ul>\n</dd>\n</dl>\n",
        default_val: "classic"
      },
      n_features_to_select: {
        type: "float",
        tooltip:
          "<p>The maximum number of features to select with feature_selection. If &lt;1,\nit\u2019s the fraction of starting features. Note that this parameter doesn\u2019t\ntake features in ignore_features or keep_features into account\nwhen counting.</p>\n",
        default_val: "0.2",
        min: 0.0,
        max: 1.0
      }
    },
    code: ""
  },
  dataset: {
    options: {
      data_func: {
        type: "data-function",
        tooltip:
          "<p>The function that generate data (the dataframe-like input). This\nis useful when the dataset is large, and you need parallel operations\nsuch as compare_models. It can avoid broadcasting large dataset\nfrom driver to workers. Notice one and only one of data and\ndata_func must be set.</p>\n",
        default_val: ""
      },
      index: {
        type: "bool-int-str",
        tooltip:
          "<dl >\n<dt>Handle indices in the <cite>data</cite> dataframe.</dt><dd><ul >\n<li><p>If False: Reset to RangeIndex.</p></li>\n<li><p>If True: Keep the provided index.</p></li>\n<li><p>If int: Position of the column to use as index.</p></li>\n<li><p>If str: Name of the column to use as index.</p></li>\n<li><p>If sequence: Array with shape=(n_samples,) to use as index.</p></li>\n</ul>\n</dd>\n</dl>\n",
        default_val: "True"
      },
      train_size: {
        type: "float",
        tooltip: "<p>Proportion of the dataset to be used for training and validation. Should be\nbetween 0.0 and 1.0.</p>\n",
        default_val: "0.7",
        "min": 0.1,
        "max": 0.99
      },
      test_data: {
        type: "dataframe",
        tooltip: "<p>If not None, test_data is used as a hold-out set and <cite>train_size</cite> parameter\nis ignored. The columns of data and test_data must match.</p>\n",
        default_val: "None"
      },
      ordinal_features: {
        type: "dict",
        tooltip:
          "<p>Categorical features to be encoded ordinally. For example, a categorical\nfeature with \u2018low\u2019, \u2018medium\u2019, \u2018high\u2019 values where low &lt; medium &lt; high can\nbe passed as ordinal_features = {\u2018column_name\u2019 : [\u2018low\u2019, \u2018medium\u2019, \u2018high\u2019]}.</p>\n",
        default_val: "None"
      },
      numeric_features: {
        type: "custom-list",
        tooltip:
          "<p>If the inferred data types are not correct, the numeric_features param can\nbe used to define the data types. It takes a list of strings with column\nnames that are numeric.</p>\n",
        default_val: "None"
      },
      categorical_features: {
        type: "custom-list",
        tooltip:
          "<p>If the inferred data types are not correct, the categorical_features param\ncan be used to define the data types. It takes a list of strings with column\nnames that are categorical.</p>\n",
        default_val: "None"
      },
      date_features: {
        type: "custom-list",
        tooltip:
          "<p>If the inferred data types are not correct, the date_features param can be\nused to overwrite the data types. It takes a list of strings with column\nnames that are DateTime.</p>\n",
        default_val: "None"
      },
      text_features: {
        type: "custom-list",
        tooltip: "<p>Column names that contain a text corpus. If None, no text features are\nselected.</p>\n",
        default_val: "None"
      },
      ignore_features: {
        type: "custom-list",
        tooltip: "<p>ignore_features param can be used to ignore features during preprocessing\nand model training. It takes a list of strings with column names that are\nto be ignored.</p>\n",
        default_val: "None"
      },
      keep_features: {
        type: "custom-list",
        tooltip:
          "<p>keep_features param can be used to always keep specific features during\npreprocessing, i.e. these features are never dropped by any kind of\nfeature selection. It takes a list of strings with column names that are\nto be kept.</p>\n",
        default_val: "None"
      },
      preprocess: {
        type: "bool",
        tooltip:
          "<p>When set to False, no transformations are applied except for train_test_split\nand custom transformations passed in custom_pipeline param. Data must be\nready for modeling (no missing values, no dates, categorical data encoding),\nwhen preprocess is set to False.</p>\n",
        default_val: "True"
      },
      create_date_columns: {
        type: "custom-list",
        tooltip:
          "<p>Columns to create from the date features. Note that created features\nwith zero variance (e.g. the feature hour in a column that only contains\ndates) are ignored. Allowed values are datetime attributes from\n<cite>pandas.Series.dt</cite>. The datetime format of the feature is inferred\nautomatically from the first non NaN value.</p>\n",
        default_val: "[\u201cday\u201d, \u201cmonth\u201d, \u201cyear\u201d]"
      },
      text_features_method: {
        type: "string",
        tooltip:
          "<p>Method with which to embed the text features in the dataset. Choose\nbetween \u201cbow\u201d (Bag of Words - CountVectorizer) or \u201ctf-idf\u201d (TfidfVectorizer).\nBe aware that the sparse matrix output of the transformer is converted\ninternally to its full array. This can cause memory issues for large\ntext embeddings.</p>\n",
        default_val: "\u201ctf-idf\u201d"
      },
      max_encoding_ohe: {
        type: "int",
        tooltip:
          "<p>Categorical columns with <cite>max_encoding_ohe</cite> or less unique values are\nencoded using OneHotEncoding. If more, the <cite>encoding_method</cite> estimator\nis used. Note that columns with exactly two classes are always encoded\nordinally. Set to below 0 to always use OneHotEncoding.</p>\n",
        default_val: "25"
      },
      encoding_method: {
        type: "category-encoders estimator",
        tooltip:
          "<p>A <cite>category-encoders</cite> estimator to encode the categorical columns\nwith more than <cite>max_encoding_ohe</cite> unique values. If None,\n<cite>category_encoders.target_encoder.TargetEncoder</cite> is used.</p>\n",
        default_val: "None"
      },
      rare_to_value: {
        type: "float",
        tooltip:
          "<p>Minimum fraction of category occurrences in a categorical column.\nIf a category is less frequent than <cite>rare_to_value * len(X)</cite>, it is\nreplaced with the string in <cite>rare_value</cite>. Use this parameter to group\nrare categories before encoding the column. If None, ignores this step.</p>\n",
        default_val: "one"
      },
      rare_value: {
        type: "string",
        tooltip: "<p>Value with which to replace rare categories. Ignored when\nrare_to_value is None.</p>\n",
        default_val: "rare\u201d"
      },
      low_variance_threshold: {
        type: "float",
        tooltip:
          "<p>Remove features with a training-set variance lower than the provided\nthreshold. If 0, keep all features with non-zero variance, i.e. remove\nthe features that have the same value in all samples. If None, skip\nthis transformation step.</p>\n",
        default_val: "None"
      },
      group_features: {
        type: "dict",
        tooltip:
          "<p>When the dataset contains features with related characteristics,\nadd new fetaures with the following statistical properties of that\ngroup: min, max, mean, std, median and mode. The parameter takes a\ndict with the group name as key and a list of feature names\nbelonging to that group as value.</p>\n",
        default_val: "None"
      },
      drop_groups: {
        type: "bool",
        tooltip: "<p>Whether to drop the original features in the group. Ignored when\ngroup_features is None.</p>\n",
        default_val: "alse"
      },
      bin_numeric_features: {
        type: "custom-list",
        tooltip:
          "<p>To convert numeric features into categorical, bin_numeric_features parameter can\nbe used. It takes a list of strings with column names to be discretized. It does\nso by using \u2018sturges\u2019 rule to determine the number of clusters and then apply\nKMeans algorithm. Original values of the feature are then replaced by the\ncluster label.</p>\n",
        default_val: "None"
      },
      outliers_method: {
        type: "string",
        tooltip:
          "<p>Method with which to remove outliers. Ignored when <cite>remove_outliers=False</cite>.\nPossible values are:</p>\n<blockquote>\n<div><ul >\n<li><p>\u2018iforest\u2019: Uses sklearn\u2019s IsolationForest.</p></li>\n<li><p>\u2018ee\u2019: Uses sklearn\u2019s EllipticEnvelope.</p></li>\n<li><p>\u2018lof\u2019: Uses sklearn\u2019s LocalOutlierFactor.</p></li>\n</ul>\n</div></blockquote>\n",
        default_val: "\u201ciforest\u201d"
      },
      fix_imbalance: {
        type: "bool",
        tooltip:
          "<p>When training dataset has unequal distribution of target class it can be balanced\nusing this parameter. When set to True, SMOTE (Synthetic Minority Over-sampling\nTechnique) is applied by default to create synthetic datapoints for minority class.</p>\n",
        default_val: "False"
      },
      fix_imbalance_method: {
        type: "string",
        tooltip:
          "<p>Estimator with which to perform class balancing. Choose from the name\nof an <cite>imblearn</cite> estimator, or a custom instance of such. Ignored when\n<cite>fix_imbalance=False</cite>.</p>\n",
        default_val: "\u201cSMOTE\u201d"
      },
      custom_pipeline: {
        type: "list of (str, transformer), dict or Pipeline",
        tooltip: "<p>Addidiotnal custom transformers. If passed, they are applied to the\npipeline last, after all the build-in transformers.</p>\n",
        default_val: "None"
      },
      custom_pipeline_position: {
        type: "int",
        tooltip: "<p>Position of the custom pipeline in the overal preprocessing pipeline.\nThe default value adds the custom pipeline last.</p>\n",
        default_val: "-1"
      },
      data_split_shuffle: {
        type: "bool",
        tooltip: "<p>When set to False, prevents shuffling of rows during \u2018train_test_split\u2019.</p>\n",
        default_val: "True"
      },
      data_split_stratify: {
        type: "bool",
        tooltip:
          "<p>Controls stratification during \u2018train_test_split\u2019. When set to True, will\nstratify by target column. To stratify on any other columns, pass a list of\ncolumn names. Ignored when data_split_shuffle is False.</p>\n",
        default_val: "True"
      },
      fold_strategy: {
        type: "string",
        tooltip:
          '<p>Choice of cross validation strategy. Possible values are:</p>\n<ul >\n<li><p>\u2018kfold\u2019</p></li>\n<li><p>\u2018stratifiedkfold\u2019</p></li>\n<li><p>\u2018groupkfold\u2019</p></li>\n<li><p>\u2018timeseries\u2019</p></li>\n<li><p>a custom CV generator object compatible with scikit-learn.</p></li>\n</ul>\n<p>For groupkfold, column name must be passed in fold_groups parameter.\nExample: setup(fold_strategy="groupkfold", fold_groups="COLUMN_NAME")</p>\n',
        default_val: "stratifiedkfold"
      },
      fold: {
        type: "int",
        tooltip:
          "<p>Number of folds to be used in cross validation. Must be at least 2. This is\na global setting that can be over-written at function level by using fold\nparameter. Ignored when fold_strategy is a custom object.</p>\n",
        default_val: "10"
      },
      fold_shuffle: {
        type: "bool",
        tooltip:
          "<p>Controls the shuffle parameter of CV. Only applicable when fold_strategy\nis \u2018kfold\u2019 or \u2018stratifiedkfold\u2019. Ignored when fold_strategy is a custom\nobject.</p>\n",
        default_val: "False"
      },
      fold_groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when \u2018GroupKFold\u2019 is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in the training dataset. When string is passed, it is interpreted\nas the column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      n_jobs: {
        type: "int",
        tooltip:
          "<p>The number of jobs to run in parallel (for functions that supports parallel\nprocessing) -1 means using all processors. To run all functions on single\nprocessor set n_jobs to None.</p>\n",
        default_val: "-1"
      },
      use_gpu: {
        type: "list",
        tooltip:
          "<p>When set to True, it will use GPU for training with algorithms that support it,\nand fall back to CPU if they are unavailable. When set to \u2018force\u2019, it will only\nuse GPU-enabled algorithms and raise exceptions when they are unavailable. When\nFalse, all algorithms are trained using CPU only.</p>\n<p>GPU enabled algorithms:</p>\n<ul >\n<li><p>Extreme Gradient Boosting, requires no further installation</p></li>\n<li><p>CatBoost Classifier, requires no further installation</p></li>\n</ul>\n<p>(GPU is only enabled when data &gt; 50,000 rows)</p>\n<ul >\n<li><p>Light Gradient Boosting Machine, requires GPU installation</p></li>\n</ul>\n<p>https://lightgbm.readthedocs.io/en/latest/GPU-Tutorial.html</p>\n<ul >\n<li><p>Logistic Regression, Ridge Classifier, Random Forest, K Neighbors Classifier,</p></li>\n</ul>\n<p>Support Vector Machine, requires cuML &gt;= 0.15\nhttps://github.com/rapidsai/cuml</p>\n",
        default_val: "False",
        choices: {
          False: "tooltip False",
          True: "tooltip True",
          force: "tooltip force"
        }
      },
      html: {
        type: "bool",
        tooltip:
          "<p>When set to False, prevents runtime display of monitor. This must be set to False\nwhen the environment does not support IPython. For example, command line terminal,\nDatabricks Notebook, Spyder and other similar IDEs.</p>\n",
        default_val: "True"
      },
      session_id: {
        type: "int",
        tooltip:
          "<p>Controls the randomness of experiment. It is equivalent to \u2018random_state\u2019 in\nscikit-learn. When None, a pseudo random number is generated. This can be used\nfor later reproducibility of the entire experiment.</p>\n",
        default_val: "None"
      },
      experiment_name: {
        type: "string",
        tooltip: "<p>Name of the experiment for logging. Ignored when log_experiment is False.</p>\n",
        default_val: "None"
      },
      experiment_custom_tags: {
        type: "dict",
        tooltip: "<p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n",
        default_val: "None"
      },
      log_plots: {
        type: "bool",
        tooltip:
          "<p>When set to True, certain plots are logged automatically in the MLFlow server.\nTo change the type of plots to be logged, pass a list containing plot IDs. Refer\nto documentation of plot_model. Ignored when log_experiment is False.</p>\n",
        default_val: "False"
      },
      log_profile: {
        type: "bool",
        tooltip: "<p>When set to True, data profile is logged on the MLflow server as a html file.\nIgnored when log_experiment is False.</p>\n",
        default_val: "False"
      },
      log_data: {
        type: "bool",
        tooltip: "<p>When set to True, dataset is logged on the MLflow server as a csv file.\nIgnored when log_experiment is False.</p>\n",
        default_val: "False"
      },
      engine: {
        type: "Optional[Dict[str, str]] = None",
        tooltip:
          "<p>The execution engines to use for the models in the form of a dict\nof <cite>model_id: engine</cite> - e.g. for Logistic Regression (\u201clr\u201d, users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engine={\u201clr\u201d: \u201csklearnex\u201d}</cite></p>\n",
        default_val: ""
      },
      verbose: {
        type: "bool",
        tooltip: "<p>When set to False, Information grid is not printed.</p>\n",
        default_val: "True"
      },
      memory: {
        type: "str, bool or Memory",
        tooltip:
          "<dl >\n<dt>Used to cache the fitted transformers of the pipeline.</dt><dd><p>If False: No caching is performed.\nIf True: A default temp directory is used.\nIf str: Path to the caching directory.</p>\n</dd>\n</dl>\n",
        default_val: "rue"
      },
      profile: {
        type: "bool",
        tooltip: "<p>When set to True, an interactive EDA report is displayed.</p>\n",
        default_val: "False"
      },
      profile_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the ProfileReport method used\nto create the EDA report. Ignored if profile is False.</p>\n",
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
    code: "",
    default: {
      files: {
        type: "data-input",
        tooltip: "<p>Specify path to csv file or to medomics folder</p>"
      }
    }
  },
  optimize: {
    subNodes: ["tune_model", "ensemble_model", "blend_models", "stack_models", "calibrate_model"],
    options: {},
    code: ""
  },
  compare_models: {
    options: {
      include: {
        type: "list-multiple",
        tooltip:
          "<p>To train and evaluate select models, list containing model ID or scikit-learn\ncompatible object can be passed in include param. To see a list of all models\navailable in the model library use the Model node.</p>\n",
        default_val: "None",
        choices: {
          lr: "Logistic Regression",
          knn: "K Neighbors Classifier",
          nb: "Naive Bayes",
          dt: "Decision Tree Classifier",
          svm: "SVM - Linear Kernel",
          rbfsvm: "SVM - Radial Kernel",
          gpc: "Gaussian Process Classifier",
          mlp: "MLP Classifier",
          ridge: "Ridge Classifier",
          rf: "Random Forest Classifier",
          qda: "Quadratic Discriminant Analysis",
          ada: "Ada Boost Classifier",
          gbc: "Gradient Boosting Classifier",
          lda: "Linear Discriminant Analysis",
          et: "Extra Trees Classifier",
          dummy: "Dummy Classifier",
          xgboost: "Extreme Gradient Boosting",
          lightgbm: "Light Gradient Boosting Machine",
          catboost: "CatBoost Classifier"
        }
      },
      exclude: {
        type: "list-multiple",
        tooltip:
          "<p>To omit certain models from training and evaluation, pass a list containing\nmodel id in the exclude parameter. To see a list of all models available\nin the model library use the Model node.</p>\n",
        default_val: "None",
        choices: {
          lr: "Logistic Regression",
          knn: "K Neighbors Classifier",
          nb: "Naive Bayes",
          dt: "Decision Tree Classifier",
          svm: "SVM - Linear Kernel",
          rbfsvm: "SVM - Radial Kernel",
          gpc: "Gaussian Process Classifier",
          mlp: "MLP Classifier",
          ridge: "Ridge Classifier",
          rf: "Random Forest Classifier",
          qda: "Quadratic Discriminant Analysis",
          ada: "Ada Boost Classifier",
          gbc: "Gradient Boosting Classifier",
          lda: "Linear Discriminant Analysis",
          et: "Extra Trees Classifier",
          dummy: "Dummy Classifier",
          xgboost: "Extreme Gradient Boosting",
          lightgbm: "Light Gradient Boosting Machine",
          catboost: "CatBoost Classifier"
        }
      },
      fold: {
        type: "int",
        tooltip:
          "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
        default_val: "None",
        min: 2,
        max: 20
      },
      round: {
        type: "int",
        tooltip: "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
        default_val: "4",
        min: 0,
        max: 6
      },
      cross_validation: {
        type: "bool",
        tooltip: "<p>When set to False, metrics are evaluated on holdout set. fold param\nis ignored when cross_validation is set to False.</p>\n",
        default_val: "True"
      },
      sort: {
        type: "string",
        tooltip: "<p>The sort order of the score grid. It also accepts custom metrics that are\nadded through the add_metric function.</p>\n",
        default_val: "Accuracy"
      },
      n_select: {
        type: "int",
        tooltip: "<p>Number of top_n models to return. For example, to select top 3 models use\nn_select = 3.</p>\n",
        default_val: "1",
        min: 1,
        max: 20
      },
      budget_time: {
        type: "float",
        tooltip: "<p>If not None, will terminate execution of the function after budget_time\nminutes have passed and return results up to that point.</p>\n",
        default_val: "None"
      },
      turbo: {
        type: "bool",
        tooltip: "<p>When set to True, it excludes estimators with longer training times. To\nsee which algorithms are excluded use the models function.</p>\n",
        default_val: "True"
      },
      errors: {
        type: "string",
        tooltip: "<p>When set to \u2018ignore\u2019, will skip the model with exceptions and continue.\nIf \u2018raise\u2019, will break the function when exceptions are raised.</p>\n",
        default_val: "ignore"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when \u2018GroupKFold\u2019 is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in the training dataset. When string is passed, it is interpreted\nas the column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      experiment_custom_tags: {
        type: "dict",
        tooltip: "<p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n",
        default_val: "None"
      },
      probability_threshold: {
        type: "float",
        tooltip:
          "<p>Threshold for converting predicted probability to class label.\nIt defaults to 0.5 for all classifiers unless explicitly defined\nin this parameter. Only applicable for binary classification.</p>\n",
        default_val: "None"
      },
      engine: {
        type: "Optional[Dict[str, str]] = None",
        tooltip:
          "<p>The execution engines to use for the models in the form of a dict\nof <cite>model_id: engine</cite> - e.g. for Logistic Regression (\u201clr\u201d, users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engine={\u201clr\u201d: \u201csklearnex\u201d}</cite></p>\n",
        default_val: ""
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Score grid is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      }
    },
    code: " "
  },
  create_model: {
    options: {
      fold: {
        type: "int",
        tooltip:
          "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
        default_val: "None",
        min: 2,
        max: 20
      },
      round: {
        type: "int",
        tooltip: "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
        default_val: "4",
        min: 0,
        max: 6
      },
      cross_validation: {
        type: "bool",
        tooltip: "<p>When set to False, metrics are evaluated on holdout set. fold param\nis ignored when cross_validation is set to False.</p>\n",
        default_val: "True"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      probability_threshold: {
        type: "float",
        tooltip:
          "<p>Threshold for converting predicted probability to class label.\nIt defaults to 0.5 for all classifiers unless explicitly defined\nin this parameter. Only applicable for binary classification.</p>\n",
        default_val: "None"
      },
      experiment_custom_tags: {
        type: "dict",
        tooltip: "<p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n",
        default_val: "None"
      },
      engine: {
        type: "Optional[str] = None",
        tooltip:
          "<p>The execution engine to use for the model, e.g. for Logistic Regression (\u201clr\u201d), users can\nswitch between \u201csklearn\u201d and \u201csklearnex\u201d by specifying\n<cite>engine=\u201dsklearnex\u201d</cite>.</p>\n",
        default_val: ""
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Score grid is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip:
          "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
        default_val: "False"
      }
    },
    code: "",
    default: {}
  },
  analyze: {
    plot_model: {
      options: {
        plot: {
          type: "string",
          tooltip:
            "<p>List of available plots (ID - Name):</p>\n<ul >\n<li><p>\u2018pipeline\u2019 - Schematic drawing of the preprocessing pipeline</p></li>\n<li><p>\u2018auc\u2019 - Area Under the Curve</p></li>\n<li><p>\u2018threshold\u2019 - Discrimination Threshold</p></li>\n<li><p>\u2018pr\u2019 - Precision Recall Curve</p></li>\n<li><p>\u2018confusion_matrix\u2019 - Confusion Matrix</p></li>\n<li><p>\u2018error\u2019 - Class Prediction Error</p></li>\n<li><p>\u2018class_report\u2019 - Classification Report</p></li>\n<li><p>\u2018boundary\u2019 - Decision Boundary</p></li>\n<li><p>\u2018rfe\u2019 - Recursive Feature Selection</p></li>\n<li><p>\u2018learning\u2019 - Learning Curve</p></li>\n<li><p>\u2018manifold\u2019 - Manifold Learning</p></li>\n<li><p>\u2018calibration\u2019 - Calibration Curve</p></li>\n<li><p>\u2018vc\u2019 - Validation Curve</p></li>\n<li><p>\u2018dimension\u2019 - Dimension Learning</p></li>\n<li><p>\u2018feature\u2019 - Feature Importance</p></li>\n<li><p>\u2018feature_all\u2019 - Feature Importance (All)</p></li>\n<li><p>\u2018parameter\u2019 - Model Hyperparameter</p></li>\n<li><p>\u2018lift\u2019 - Lift Curve</p></li>\n<li><p>\u2018gain\u2019 - Gain Chart</p></li>\n<li><p>\u2018tree\u2019 - Decision Tree</p></li>\n<li><p>\u2018ks\u2019 - KS Statistic Plot</p></li>\n</ul>\n",
          default_val: "auc"
        },
        scale: {
          type: "float",
          tooltip: "<p>The resolution scale of the figure.</p>\n",
          default_val: "1"
        },
        fold: {
          type: "int",
          tooltip:
            "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
          default_val: "None"
        },
        fit_kwargs: {
          type: "dict",
          tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
          default_val: "{} (empty dict)"
        },
        plot_kwargs: {
          type: "dict",
          tooltip: "<dl >\n<dt>Dictionary of arguments passed to the visualizer class.</dt><dd><ul >\n<li><p>pipeline: fontsize -&gt; int</p></li>\n</ul>\n</dd>\n</dl>\n",
          default_val: "{} (empty dict)"
        },
        groups: {
          type: "string",
          tooltip:
            "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
          default_val: "None"
        },
        verbose: {
          type: "bool",
          tooltip: "<p>When set to False, backend's progress bar is not displayed.</p>\n",
          default_val: "True"
        },
        display_format: {
          type: "string",
          tooltip: "<p>To display plots in Streamlit (https://www.streamlit.io/), set this to \u2018streamlit\u2019.\nCurrently, not all plots are supported.</p>\n",
          default_val: "None"
        }
      },
      code: "plot_model()",
      default: {}
    },
    interpret_model: {
      options: {
        plot: {
          type: "string",
          tooltip:
            "<p>Abbreviation of type of plot. The current list of plots supported\nare (Plot - Name):\n* \u2018summary\u2019 - Summary Plot using SHAP\n* \u2018correlation\u2019 - Dependence Plot using SHAP\n* \u2018reason\u2019 - Force Plot using SHAP\n* \u2018pdp\u2019 - Partial Dependence Plot\n* \u2018msa\u2019 - Morris Sensitivity Analysis\n* \u2018pfi\u2019 - Permutation Feature Importance</p>\n",
          default_val: "summary"
        },
        feature: {
          type: "string",
          tooltip:
            "<p>This parameter is only needed when plot = \u2018correlation\u2019 or \u2018pdp\u2019.\nBy default feature is set to None which means the first column of the\ndataset will be used as a variable. A feature parameter must be passed\nto change this.</p>\n",
          default_val: "None"
        },
        observation: {
          type: "int",
          tooltip:
            "<p>This parameter only comes into effect when plot is set to \u2018reason\u2019. If no\nobservation number is provided, it will return an analysis of all observations\nwith the option to select the feature on x and y axes through drop down\ninteractivity. For analysis at the sample level, an observation parameter must\nbe passed with the index value of the observation in test / hold-out set.</p>\n",
          default_val: "None"
        },
        use_train_data: {
          type: "bool",
          tooltip: "<p>When set to true, train data will be used for plots, instead\nof test data.</p>\n",
          default_val: "False"
        },
        X_new_sample: {
          type: "dataframe",
          tooltip:
            "<p>Row from an out-of-sample dataframe (neither train nor test data) to be plotted.\nThe sample must have the same columns as the raw input train data, and it is transformed\nby the preprocessing pipeline automatically before plotting.</p>\n",
          default_val: "None"
        },
        y_new_sample: {
          type: "dataframe",
          tooltip:
            "<p>Row from an out-of-sample dataframe (neither train nor test data) to be plotted.\nThe sample must have the same columns as the raw input label data, and it is transformed\nby the preprocessing pipeline automatically before plotting.</p>\n",
          default_val: "None"
        }
      },
      code: "interpret_model()"
    },
    dashboard: {
      options: {
        display_format: {
          type: "string",
          tooltip:
            "<p>Render mode for the dashboard. The default is set to dash which will\nrender a dashboard in browser. There are four possible options:</p>\n<ul >\n<li><p>\u2018dash\u2019 - displays the dashboard in browser</p></li>\n<li><p>\u2018inline\u2019 - displays the dashboard in the jupyter notebook cell.</p></li>\n<li><p>\u2018jupyterlab\u2019 - displays the dashboard in jupyterlab pane.</p></li>\n<li><p>\u2018external\u2019 - displays the dashboard in a separate tab. (use in Colab)</p></li>\n</ul>\n",
          default_val: "dash"
        },
        dashboard_kwargs: {
          type: "dict",
          tooltip: "<p>Dictionary of arguments passed to the ExplainerDashboard class.</p>\n",
          default_val: "{} (empty dict)"
        },
        run_kwargs: {
          type: "dict",
          tooltip: "<p>Dictionary of arguments passed to the run method of ExplainerDashboard.</p>\n",
          default_val: "{} (empty dict)"
        }
      },
      code: "dashboard()",
      default: {}
    }
  },
  finalize: {
    options: {
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      model_only: {
        type: "bool",
        tooltip: "<p>Whether to return the complete fitted pipeline or only the fitted model.</p>\n",
        default_val: "False"
      },
      experiment_custom_tags: {
        type: "dict",
        tooltip: "<p>Dictionary of tag_name: String -&gt; value: (String, but will be string-ified\nif not) passed to the mlflow.set_tags to add new custom tags for the experiment.</p>\n",
        default_val: "None"
      }
    },
    code: "",
    default: {}
  },
  save_model: {
    options: {
      model_name: {
        type: "string",
        tooltip: "<p>Name of the model.</p>\n",
        default_val: "model"
      },
      model_only: {
        type: "bool",
        tooltip: "<p>When set to True, only trained model object is saved instead of the\nentire pipeline.</p>\n",
        default_val: "False"
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Success message is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      }
    },
    code: "",
    default: {}
  },
  load_model: {
    options: {
      platform: {
        type: "string",
        tooltip: "<p>Name of the cloud platform. Currently supported platforms:\n\u2018aws\u2019, \u2018gcp\u2019 and \u2018azure\u2019.</p>\n",
        default_val: "None"
      },
      authentication: {
        type: "dict",
        tooltip:
          "<p>dictionary of applicable authentication tokens.</p>\n<p>when platform = \u2018aws\u2019:\n{\u2018bucket\u2019 : \u2018Name of Bucket on S3\u2019, \u2018path\u2019: (optional) folder name under the bucket}</p>\n<p>when platform = \u2018gcp\u2019:\n{\u2018project\u2019: \u2018gcp-project-name\u2019, \u2018bucket\u2019 : \u2018gcp-bucket-name\u2019}</p>\n<p>when platform = \u2018azure\u2019:\n{\u2018container\u2019: \u2018azure-container-name\u2019}</p>\n",
        default_val: "None"
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Success message is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      }
    },
    code: "",
    default: {
      model_to_load: {
        type: "models-input",
        tooltip: "<p>Choose a model from the MODELS folder</p>"
      }
    }
  },
  tune_model: {
    options: {
      fold: {
        type: "int",
        tooltip:
          "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
        default_val: "None",
        min: 2,
        max: 20
      },
      round: {
        type: "int",
        tooltip: "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
        default_val: "4",
        min: 0,
        max: 6
      },
      n_iter: {
        type: "int",
        tooltip: "<p>Number of iterations in the grid search. Increasing \u2018n_iter\u2019 may improve\nmodel performance but also increases the training time.</p>\n",
        default_val: "10",
        min: 1,
        max: 200
      },
      custom_grid: {
        type: "dict",
        tooltip:
          "<p>To define custom search space for hyperparameters, pass a dictionary with\nparameter name and values to be iterated. Custom grids must be in a format\nsupported by the defined search_library.</p>\n",
        default_val: "None"
      },
      optimize: {
        type: "string",
        tooltip: "<p>Metric name to be evaluated for hyperparameter tuning. It also accepts custom\nmetrics that are added through the add_metric function.</p>\n",
        default_val: "Accuracy"
      },
      custom_scorer: {
        type: "object",
        tooltip:
          "<p>custom scoring strategy can be passed to tune hyperparameters of the model.\nIt must be created using sklearn.make_scorer. It is equivalent of adding\ncustom metric using the add_metric function and passing the name of the\ncustom metric in the optimize parameter.\nWill be deprecated in future.</p>\n",
        default_val: "None"
      },
      search_library: {
        type: "string",
        tooltip:
          "<p>The search library used for tuning hyperparameters. Possible values:</p>\n<ul >\n<li><dl >\n<dt>\u2018scikit-learn\u2019 - default, requires no further installation</dt><dd><p>https://github.com/scikit-learn/scikit-learn</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018scikit-optimize\u2019 - pip install scikit-optimize</dt><dd><p>https://scikit-optimize.github.io/stable/</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018tune-sklearn\u2019 - pip install tune-sklearn ray[tune]</dt><dd><p>https://github.com/ray-project/tune-sklearn</p>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018optuna\u2019 - pip install optuna</dt><dd><p>https://optuna.org/</p>\n</dd>\n</dl>\n</li>\n</ul>\n",
        default_val: "scikit-learn"
      },
      search_algorithm: {
        type: "string",
        tooltip:
          "<p>The search algorithm depends on the search_library parameter.\nSome search algorithms require additional libraries to be installed.\nIf None, will use search library-specific default algorithm.</p>\n<ul >\n<li><dl >\n<dt>\u2018scikit-learn\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : random grid search (default)</p></li>\n<li><p>\u2018grid\u2019 : grid search</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018scikit-optimize\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018bayesian\u2019 : Bayesian search (default)</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018tune-sklearn\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : random grid search (default)</p></li>\n<li><p>\u2018grid\u2019 : grid search</p></li>\n<li><p>\u2018bayesian\u2019 : pip install scikit-optimize</p></li>\n<li><p>\u2018hyperopt\u2019 : pip install hyperopt</p></li>\n<li><p>\u2018optuna\u2019 : pip install optuna</p></li>\n<li><p>\u2018bohb\u2019 : pip install hpbandster ConfigSpace</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n<li><dl >\n<dt>\u2018optuna\u2019 possible values:</dt><dd><ul>\n<li><p>\u2018random\u2019 : randomized search</p></li>\n<li><p>\u2018tpe\u2019 : Tree-structured Parzen Estimator search (default)</p></li>\n</ul>\n</dd>\n</dl>\n</li>\n</ul>\n",
        default_val: "None"
      },
      early_stopping: {
        type: "string",
        tooltip:
          "<p>Use early stopping to stop fitting to a hyperparameter configuration\nif it performs poorly. Ignored when search_library is scikit-learn,\nor if the estimator does not have \u2018partial_fit\u2019 attribute. If False or\nNone, early stopping will not be used. Can be either an object accepted\nby the search library or one of the following:</p>\n<ul >\n<li><p>\u2018asha\u2019 for Asynchronous Successive Halving Algorithm</p></li>\n<li><p>\u2018hyperband\u2019 for Hyperband</p></li>\n<li><p>\u2018median\u2019 for Median Stopping Rule</p></li>\n<li><p>If False or None, early stopping will not be used.</p></li>\n</ul>\n",
        default_val: "False"
      },
      early_stopping_max_iters: {
        type: "int",
        tooltip: "<p>Maximum number of epochs to run for each sampled configuration.\nIgnored if early_stopping is False or None.</p>\n",
        default_val: "10",
        min: 1,
        max: 200
      },
      choose_better: {
        type: "bool",
        tooltip: "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
        default_val: "True"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the tuner.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      return_tuner: {
        type: "bool",
        tooltip: "<p>When set to True, will return a tuple of (model, tuner_object).</p>\n",
        default_val: "False"
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Score grid is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      },
      tuner_verbose: {
        type: "int",
        tooltip: "<p>If True or above 0, will print messages from the tuner. Higher values\nprint more messages. Ignored when verbose param is False.</p>\n",
        default_val: 0,
        min: 0,
        max: 3
      },
      return_train_score: {
        type: "bool",
        tooltip:
          "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
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
        tooltip: "<p>Method for ensembling base estimator. It can be \u2018Bagging\u2019 or \u2018Boosting\u2019.</p>\n",
        default_val: "Bagging"
      },
      fold: {
        type: "int",
        tooltip:
          "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
        default_val: "None",
        min: 2,
        max: 20
      },
      n_estimators: {
        type: "int",
        tooltip: "<p>The number of base estimators in the ensemble. In case of perfect fit, the\nlearning procedure is stopped early.</p>\n",
        default_val: "10",
        min: 1,
        max: 200
      },
      round: {
        type: "int",
        tooltip: "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
        default_val: "4",
        min: 0,
        max: 6
      },
      choose_better: {
        type: "bool",
        tooltip: "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
        default_val: "False"
      },
      optimize: {
        type: "string",
        tooltip: "<p>Metric to compare for model selection when choose_better is True.</p>\n",
        default_val: "Accuracy"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      probability_threshold: {
        type: "float",
        tooltip:
          "<p>Threshold for converting predicted probability to class label.\nIt defaults to 0.5 for all classifiers unless explicitly defined\nin this parameter. Only applicable for binary classification.</p>\n",
        default_val: "None"
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Score grid is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip:
          "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
        default_val: "False"
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
        tooltip:
          "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
        default_val: "None",
        min: 2,
        max: 20
      },
      round: {
        type: "int",
        tooltip: "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
        default_val: "4",
        min: 0,
        max: 6
      },
      choose_better: {
        type: "bool",
        tooltip: "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
        default_val: "False"
      },
      optimize: {
        type: "string",
        tooltip: "<p>Metric to compare for model selection when choose_better is True.</p>\n",
        default_val: "Accuracy"
      },
      method: {
        type: "string",
        tooltip:
          "<p>\u2018hard\u2019 uses predicted class labels for majority rule voting. \u2018soft\u2019, predicts\nthe class label based on the argmax of the sums of the predicted probabilities,\nwhich is recommended for an ensemble of well-calibrated classifiers. Default\nvalue, \u2018auto\u2019, will try to use \u2018soft\u2019 and fall back to \u2018hard\u2019 if the former is\nnot supported.</p>\n",
        default_val: "auto"
      },
      weights: {
        type: "custom-list",
        tooltip:
          "<p>Sequence of weights (float or int) to weight the occurrences of predicted class\nlabels (hard voting) or class probabilities before averaging (soft voting). Uses\nuniform weights when None.</p>\n",
        default_val: "None"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      probability_threshold: {
        type: "float",
        tooltip:
          "<p>Threshold for converting predicted probability to class label.\nIt defaults to 0.5 for all classifiers unless explicitly defined\nin this parameter. Only applicable for binary classification.</p>\n",
        default_val: "None"
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Score grid is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip:
          "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
        default_val: "False"
      }
    },
    ml_types: "classification regression",
    code: "blend_models()",
    default: {}
  },
  stack_models: {
    options: {
      meta_model: {
        type: "list",
        tooltip: "<p>When None, Logistic Regression is trained as a meta model.</p>\n",
        default_val: "None",
        choices: {
          lr: "Logistic Regression",
          knn: "K Neighbors Classifier",
          nb: "Naive Bayes",
          dt: "Decision Tree Classifier",
          svm: "SVM - Linear Kernel",
          rbfsvm: "SVM - Radial Kernel",
          gpc: "Gaussian Process Classifier",
          mlp: "MLP Classifier",
          ridge: "Ridge Classifier",
          rf: "Random Forest Classifier",
          qda: "Quadratic Discriminant Analysis",
          ada: "Ada Boost Classifier",
          gbc: "Gradient Boosting Classifier",
          lda: "Linear Discriminant Analysis",
          et: "Extra Trees Classifier",
          xgboost: "Extreme Gradient Boosting",
          lightgbm: "Light Gradient Boosting Machine",
          catboost: "CatBoost Classifier"
        }
      },
      meta_model_fold: {
        type: "int",
        tooltip:
          "<p>Controls internal cross-validation. Can be an integer or a scikit-learn\nCV generator. If set to an integer, will use (Stratifed)KFold CV with\nthat many folds. See scikit-learn documentation on Stacking for\nmore details.</p>\n",
        default_val: "5",
        min: 2,
        max: 20
      },
      fold: {
        type: "int",
        tooltip:
          "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
        default_val: "None",
        min: 2,
        max: 20
      },
      round: {
        type: "int",
        tooltip: "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
        default_val: "4",
        min: 0,
        max: 6
      },
      method: {
        type: "string",
        tooltip:
          "<p>When set to \u2018auto\u2019, it will invoke, for each estimator, \u2018predict_proba\u2019,\n\u2018decision_function\u2019 or \u2018predict\u2019 in that order. Other, manually pass one\nof the value from \u2018predict_proba\u2019, \u2018decision_function\u2019 or \u2018predict\u2019.</p>\n",
        default_val: "auto"
      },
      restack: {
        type: "bool",
        tooltip: "<p>When set to False, only the predictions of estimators will be used as\ntraining data for the meta_model.</p>\n",
        default_val: "False"
      },
      choose_better: {
        type: "bool",
        tooltip: "<p>When set to True, the returned object is always better performing. The\nmetric used for comparison is defined by the optimize parameter.</p>\n",
        default_val: "False"
      },
      optimize: {
        type: "string",
        tooltip: "<p>Metric to compare for model selection when choose_better is True.</p>\n",
        default_val: "Accuracy"
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      probability_threshold: {
        type: "float",
        tooltip:
          "<p>Threshold for converting predicted probability to class label.\nIt defaults to 0.5 for all classifiers unless explicitly defined\nin this parameter. Only applicable for binary classification.</p>\n",
        default_val: "None"
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Score grid is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip:
          "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
        default_val: "False"
      }
    },
    ml_types: "classification regression",
    code: "stack_models()",
    default: {}
  },
  calibrate_model: {
    options: {
      method: {
        type: "string",
        tooltip: "<p>The method to use for calibration. Can be \u2018sigmoid\u2019 which corresponds to\nPlatt\u2019s method or \u2018isotonic\u2019 which is a non-parametric approach.</p>\n",
        default_val: "sigmoid"
      },
      calibrate_fold: {
        type: "int",
        tooltip:
          "<p>Controls internal cross-validation. Can be an integer or a scikit-learn\nCV generator. If set to an integer, will use (Stratifed)KFold CV with\nthat many folds. See scikit-learn documentation on Stacking for\nmore details.</p>\n",
        default_val: "5",
        min: 2,
        max: 20
      },
      fold: {
        type: "int",
        tooltip:
          "<p>Controls cross-validation. If None, the CV generator in the fold_strategy\nparameter of the setup function is used. When an integer is passed,\nit is interpreted as the \u2018n_splits\u2019 parameter of the CV generator in the\nsetup function.</p>\n",
        default_val: "None",
        min: 2,
        max: 20
      },
      round: {
        type: "int",
        tooltip: "<p>Number of decimal places the metrics in the score grid will be rounded to.</p>\n",
        default_val: "4",
        min: 0,
        max: 6
      },
      fit_kwargs: {
        type: "dict",
        tooltip: "<p>Dictionary of arguments passed to the fit method of the model.</p>\n",
        default_val: "{} (empty dict)"
      },
      groups: {
        type: "string",
        tooltip:
          "<p>Optional group labels when GroupKFold is used for the cross validation.\nIt takes an array with shape (n_samples, ) where n_samples is the number\nof rows in training dataset. When string is passed, it is interpreted as\nthe column name in the dataset containing group labels.</p>\n",
        default_val: "None"
      },
      verbose: {
        type: "bool",
        tooltip: "<p>Score grid is not printed when verbose is set to False.</p>\n",
        default_val: "True"
      },
      return_train_score: {
        type: "bool",
        tooltip:
          "<p>If False, returns the CV Validation scores only.\nIf True, returns the CV training scores along with the CV validation scores.\nThis is useful when the user wants to do bias-variance tradeoff. A high CV\ntraining score with a low corresponding CV validation score indicates overfitting.</p>\n",
        default_val: "False"
      }
    },
    ml_types: "classification",
    code: "calibrate_model()",
    default: {}
  },
  group_models: {
    options: {},
    code: ""
  }
}
export default classificationSettings

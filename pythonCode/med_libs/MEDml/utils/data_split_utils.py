import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, train_test_split


def get_cv_stratification_details(dataset, stratify_column, class_names, cv_folds=5, random_state=42):
    """
    Returns detailed fold stratification report with robust class handling
    
    Args:
        dataset (pd.DataFrame): The dataset containing the stratification column.
        stratify_column (str): The column name to stratify by.
        class_names (str): A string of class names separated by underscores, e.g. "class1_class2_class3".
        cv_folds (int): Number of folds for cross-validation.
        random_state (int): Random seed for reproducibility.
    Returns:
        pd.DataFrame: A DataFrame containing the stratification details for each fold.
    """
    y = dataset[stratify_column].values
    n_samples = len(y)
    
    # Initialize StratifiedKFold
    splitter = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
    
    # Analyze each fold
    fold_stats = []
    for fold_idx, (train_idx, test_idx) in enumerate(splitter.split(np.zeros(n_samples), y)):
        # Get UNIQUE classes for this specific fold's train/test sets
        train_classes, train_counts = np.unique(y[train_idx], return_counts=True)
        test_classes, test_counts = np.unique(y[test_idx], return_counts=True)
        
        # Create fold entry with dynamic class handling
        fold_entry = {
            'Fold': fold_idx + 1,
            'Train Samples': len(train_idx),
            'Train Samples %': round(len(train_idx) / n_samples, 2),
            'Test Samples': len(test_idx),
            'Test Samples %': round(len(test_idx) / n_samples, 2)
        }
        
        # Add train class counts (will include all classes due to stratification)
        for cls, cnt in zip(train_classes, train_counts):
            if '_' in str(cls):
                # Handle multi-label classes
                cls_idxs = [c for c in cls.split('_')]
                class_name = []
                for c in range(len(class_names.split('_'))):
                    if class_names.split('_')[c].startswith('XTAGX') and int(cls_idxs[c]) == 1:
                        class_name.append(class_names.split('_')[c][5:])  # Remove 'XTAGX' prefix
                    elif not class_names.split('_')[c].startswith('XTAGX'):
                        class_name.append(class_names.split('_')[c] + '-' + str(cls_idxs[c]))
                class_name = '_'.join(class_name)
            else:
                class_name = class_names + '-' + str(cls)  # Single class handling
            fold_entry[f'Train Class {class_name}'] = round(cnt, 2)
        
        # Add test class counts (may have missing classes)
        for cls, cnt in zip(test_classes, test_counts):
            if '_' in str(cls):
                # Handle multi-label classes
                cls_idxs = [c for c in cls.split('_')]
                class_name = []
                for c in range(len(class_names.split('_'))):
                    if class_names.split('_')[c].startswith('XTAGX') and int(cls_idxs[c]) == 1:
                        class_name.append(class_names.split('_')[c][5:])  # Remove 'XTAGX' prefix
                    elif not class_names.split('_')[c].startswith('XTAGX'):
                        class_name.append(class_names.split('_')[c] + '-' + str(cls_idxs[c]))
                class_name = '_'.join(class_name)
            else:
                class_name = class_names + '-' + str(cls)
            fold_entry[f'Test Class {class_name}'] = round(cnt, 2)
        
        fold_stats.append(fold_entry)
    
    # Convert to DataFrame
    stats_df = pd.DataFrame(fold_stats)
    
    # Calculate percentages
    for col in stats_df.columns:
        if col.startswith('Train Class '):
            cls = col.replace('Train Class ', '')
            stats_df[f'Train Class {cls} %'] = stats_df[col] / stats_df['Train Samples']
        elif col.startswith('Test Class '):
            cls = col.replace('Test Class ', '')
            stats_df[f'Test Class {cls} %'] = stats_df[col] / stats_df['Test Samples']
    
    return stats_df

def get_subsampling_details(dataset, class_names, stratify_columns=None, test_size=0.2, n_iterations=5, random_state=None):
    """
    Gets detailed subsampling report for random subsampling with optional stratification
    
    Args:
        dataset (pd.DataFrame): The dataset to analyze.
        stratify_columns (str or list of str, optional): Column(s) to stratify by. If None, no stratification.
        class_names (str): A string of class names separated by underscores, e.g. "class1_class2_class3".
        test_size (float): Proportion of the dataset to include in the test split (between 0 and 1).
        n_iterations (int): Number of iterations to perform for subsampling.
        random_state (int, optional): Random seed for reproducibility.
    Returns:
        pd.DataFrame: A DataFrame containing the subsampling details for each iteration.
    """
    n_samples = len(dataset)
    
    # Validate inputs
    if not (0 < test_size < 1):
        raise ValueError("test_size must be in (0,1)")
    if n_iterations < 1:
        raise ValueError("n_iterations must be at least 1")
    
    # Prepare stratification vector if needed
    if stratify_columns is not None:
        if isinstance(stratify_columns, str):
            stratify_columns = [stratify_columns]
        y = dataset[stratify_columns[0]].values
    else:
        y = None
    
    # Analyze each iteration
    iteration_stats = []
    for it in range(n_iterations):
        rs = random_state + it if random_state is not None else None
        
        # Perform the split
        train_idx, test_idx = train_test_split(
            np.arange(n_samples),
            test_size=test_size,
            random_state=rs,
            shuffle=True,
            stratify=y
        )
        
        # Initialize stats entry
        stats_entry = {
            'Iteration': it + 1,
            'Train Samples': len(train_idx),
            'Train Samples %': round(len(train_idx) / n_samples, 2),
            'Test Samples': len(test_idx),
            'Test Samples %': round(len(test_idx) / n_samples, 2)
        }
        
        # Add class distribution if stratified
        if y is not None:
            train_classes, train_counts = np.unique(y[train_idx], return_counts=True)
            test_classes, test_counts = np.unique(y[test_idx], return_counts=True)
            
            # Add train class counts
            for cls, cnt in zip(train_classes, train_counts):
                if '_' in str(cls):
                    # Handle multi-label classes
                    cls_idxs = [c for c in cls.split('_')]
                    class_name = []
                    for c in range(len(class_names.split('_'))):
                        if class_names.split('_')[c].startswith('XTAGX') and int(cls_idxs[c]) == 1:
                            class_name.append(class_names.split('_')[c][5:])  # Remove 'XTAGX' prefix
                        elif not class_names.split('_')[c].startswith('XTAGX'):
                            class_name.append(class_names.split('_')[c] + '-' + str(cls_idxs[c]))
                    class_name = '_'.join(class_name)
                else:
                    class_name = class_names + '-' + str(cls)
                stats_entry[f'Train Class {cls}'] = round(cnt, 2)
            
            # Add test class counts
            for cls, cnt in zip(test_classes, test_counts):
                if '_' in str(cls):
                    # Handle multi-label classes
                    cls_idxs = [c for c in cls.split('_')]
                    class_name = []
                    for c in range(len(class_names.split('_'))):
                        if class_names.split('_')[c].startswith('XTAGX') and int(cls_idxs[c]) == 1:
                            class_name.append(class_names.split('_')[c][5:])  # Remove 'XTAGX' prefix
                        elif not class_names.split('_')[c].startswith('XTAGX'):
                            class_name.append(class_names.split('_')[c] + '-' + str(cls_idxs[c]))
                    class_name = '_'.join(class_name)
                else:
                    class_name = class_names + '-' + str(cls)
                stats_entry[f'Test Class {cls}'] = round(cnt, 2)
        
        iteration_stats.append(stats_entry)
    
    # Convert to DataFrame
    stats_df = pd.DataFrame(iteration_stats)

    # Calculate percentages
    for col in stats_df.columns:
        if col.startswith('Train Class '):
            cls = col.replace('Train Class ', '')
            stats_df[f'Train Class {cls} %'] = stats_df[col] / stats_df['Train Samples']
        elif col.startswith('Test Class '):
            cls = col.replace('Test Class ', '')
            stats_df[f'Test Class {cls} %'] = stats_df[col] / stats_df['Test Samples']
    
    return stats_df

def get_bootstrapping_details(n_samples, class_names, folds, y=None):
    """
    Gets detailed bootstrapping report with optional stratification
    
    Args:
        n_samples (int): Total number of samples in the dataset.
        class_names (str): A string of class names separated by underscores, e.g. "class1_class2_class3".
        y (np.array): The stratification vector. If None, no stratification.
        folds (list): A list containing dictionaries with the train and test indices for each bootstrap iteration.
    Returns:
        pd.DataFrame: A DataFrame containing the bootstrapping details for each iteration.
    """
    # Analyze each iteration
    iteration_stats = []
    for i, fold in enumerate(folds):
        
        # Perform bootstrapping
        boot_indices = fold['train_indices']
        oob_indices = fold['test_indices']
        
        # Initialize stats entry
        stats_entry = {
            'Iteration': i + 1,
            'Bootstrap Samples': len(boot_indices),
            'Bootstrap Samples %': round(len(boot_indices) / n_samples, 2),
            'OOB Samples': len(oob_indices),
            'OOB Samples %': round(len(oob_indices) / n_samples, 2)
        }
        
        # Add class distribution if stratified
        if y is not None:
            boot_classes, boot_counts = np.unique(y[boot_indices], return_counts=True)
            oob_classes, oob_counts = np.unique(y[oob_indices], return_counts=True)
            
            # Add bootstrap class counts
            for cls, cnt in zip(boot_classes, boot_counts):
                if '_' in str(cls):
                    # Handle multi-label classes
                    cls_idxs = [c for c in cls.split('_')]
                    class_name = []
                    for c in range(len(class_names.split('_'))):
                        if class_names.split('_')[c].startswith('XTAGX') and int(cls_idxs[c]) == 1:
                            class_name.append(class_names.split('_')[c][5:])  # Remove 'XTAGX' prefix
                        elif not class_names.split('_')[c].startswith('XTAGX'):
                            class_name.append(class_names.split('_')[c] + '-' + str(cls_idxs[c]))
                    class_name = '_'.join(class_name)
                else:
                    class_name = class_names + '-' + str(cls)
                stats_entry[f'Bootstrap Class {cls}'] = round(cnt, 2)

            # Add OOB class counts
            for cls, cnt in zip(oob_classes, oob_counts):
                if '_' in str(cls):
                    # Handle multi-label classes
                    cls_idxs = [c for c in cls.split('_')]
                    class_name = []
                    for c in range(len(class_names.split('_'))):
                        if class_names.split('_')[c].startswith('XTAGX') and int(cls_idxs[c]) == 1:
                            class_name.append(class_names.split('_')[c][5:])  # Remove 'XTAGX' prefix
                        elif not class_names.split('_')[c].startswith('XTAGX'):
                            class_name.append(class_names.split('_')[c] + '-' + str(cls_idxs[c]))
                    class_name = '_'.join(class_name)
                else:
                    class_name = class_names + '-' + str(cls)
                stats_entry[f'OOB Class {cls}'] = round(cnt, 2)

        iteration_stats.append(stats_entry)
    
    # Convert to DataFrame
    stats_df = pd.DataFrame(iteration_stats)

    # Calculate percentages
    for col in stats_df.columns:
        if col.startswith('Bootstrap Class '):
            cls = col.replace('Bootstrap Class ', '')
            stats_df[f'Bootstrap Class {cls} %'] = stats_df[col] / stats_df['Bootstrap Samples']
        elif col.startswith('OOB Class '):
            cls = col.replace('OOB Class ', '')
            stats_df[f'OOB Class {cls} %'] = stats_df[col] / stats_df['OOB Samples']

    return stats_df


package input

import (
	"fmt"
	Utils "go_module/src"
	"log"
)

var prePath = "input"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/merge_datasets_DB/", handleMergeDB)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
	Utils.CreateHandleFunc(prePath+"/cleanDB/", handleCleanDB)
	Utils.CreateHandleFunc(prePath+"/create_holdout_set_DB/", handleCreateHoldoutSetDB)
	Utils.CreateHandleFunc(prePath+"/compute_eigenvaluesDB/", handleComputeEigenvaluesDB)
	Utils.CreateHandleFunc(prePath+"/create_pcaDB/", handleCreatePCADB)
	Utils.CreateHandleFunc(prePath+"/apply_pcaDB/", handleApplyPCADB)
	Utils.CreateHandleFunc(prePath+"/compute_correlationsDB/", handleComputeCorrelationsDB)
	Utils.CreateHandleFunc(prePath+"/compute_spearmanDB/", handleComputeSpearmanDB)
	Utils.CreateHandleFunc(prePath+"/create_tags/", handleCreateTags)
	Utils.CreateHandleFunc(prePath+"/handle_pkl/", handlePKL)
	Utils.CreateHandleFunc(prePath+"/delete_columns/", deleteColumns)
	Utils.CreateHandleFunc(prePath+"/transform_columns/", transformColumns)
	Utils.CreateHandleFunc(prePath+"/get_row_column_missing_values/", handleGetMissingValues)
	Utils.CreateHandleFunc(prePath+"/get_subset_data/", handleGetSubsetData)
	Utils.CreateHandleFunc(prePath+"/create_new_collection/", handleCreateNewCollection)
	Utils.CreateHandleFunc(prePath+"/overwrite_collection/", handleOverwriteCollection)
	Utils.CreateHandleFunc(prePath+"/overwrite_encoded_data", handleOverwriteEncodedData)
	Utils.CreateHandleFunc(prePath+"/append_encoded_data", handleAppendEncodedData)
	Utils.CreateHandleFunc(prePath+"/create_group_DB/", handleCreateGroupDB)
	Utils.CreateHandleFunc(prePath+"/normalizeDB/", handleNormalizeDB)
}

// handleMerge handles the request to merge the datasets for the DB
// It returns the response from the python script
func handleMergeDB(jsonConfig string, id string) (string, error) {
	log.Println("Merging datasets DB...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/mergeDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleCreateHoldoutSet handles the request to create the holdout set
// It returns the response from the python script
func handleCreateHoldoutSetDB(jsonConfig string, id string) (string, error) {
	log.Println("Creating holdout set DB...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/create_holdout_set_DB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleCleanDB handles the request to clean the DB
// It returns the response from the python script
func handleCleanDB(jsonConfig string, id string) (string, error) {
	log.Println("Cleaning DB...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/cleanDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleComputeEigenvaluesDB handles the request to compute the eigenvalues for the DB
// It returns the response from the python script
func handleComputeEigenvaluesDB(jsonConfig string, id string) (string, error) {
	log.Println("Compute Eigenvalues", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/compute_eigenvaluesDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleCreatePCADB handles the request to compute pca for the db
// It returns the response from the python script
func handleCreatePCADB(jsonConfig string, id string) (string, error) {
	log.Println("Create PCA", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/create_pcaDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleApplyPCA handles the request to compute pca with DB
// It returns the response from the python script
func handleApplyPCADB(jsonConfig string, id string) (string, error) {
	log.Println("Create PCA", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/apply_pcaDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleComputeCorrelations handles the request to compute correlations for the DB
// It returns the response from the python script
func handleComputeCorrelationsDB(jsonConfig string, id string) (string, error) {
	log.Println("Compute Correlations", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/compute_correlationsDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleComputeSpearman handles the request to compute Spearman for the DB
// It returns the response from the python script
func handleComputeSpearmanDB(jsonConfig string, id string) (string, error) {
	log.Println("Compute Spearman", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/compute_spearmanDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleProgress handles the request to get the progress of the experiment
// It returns the progress of the experiment
func handleProgress(jsonConfig string, id string) (string, error) {
	Utils.Mu.Lock()
	progress := Utils.Scripts[id].Progress
	Utils.Mu.Unlock()
	if progress != "" {
		return progress, nil
	} else {
		return "{\"now\":\"0\", \"currentLabel\":\"Warming up\"}", nil
	}
}

// handleCreateTags handles the request to create the tags for the DB
// It returns the response from the python script
func handleCreateTags(jsonConfig string, id string) (string, error) {
	log.Println("Compute Tags Creation", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/create_tags.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handlePKL handles the request to handle the pkl file
// It returns the response from the python script
func handlePKL(jsonConfig string, id string) (string, error) {
	log.Println("handling .pkl filetype", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/handle_pkl.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// deleteColumns handles the request to delete columns from the DB
// It returns the response from the python script
func deleteColumns(jsonConfig string, id string) (string, error) {
	log.Println("Deleting Columns", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/delete_columns.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// transformColumns handles the request to transform columns from the DB
// It returns the response from the python script
func transformColumns(jsonConfig string, id string) (string, error) {
	log.Println("Transforming Columns", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/transform_columns.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleGetMissingValues handles the request to get the missing values from the DB
// It returns the response from the python script
func handleGetMissingValues(jsonConfig string, id string) (string, error) {
	log.Println("Getting Missing Values", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/get_row_column_missing_values.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleGetSubsetData handles the request to get the subset data from the DB
// It returns the response from the python script
func handleGetSubsetData(jsonConfig string, id string) (string, error) {
	log.Println("Getting Subset Data", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/get_subset_data.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleCreateNewCollection handles the request to create a new collection from the DB
// It returns the response from the python script
func handleCreateNewCollection(jsonConfig string, id string) (string, error) {
	log.Println("Creating New Collection", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/create_new_collection.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleOverwriteCollection handles the request to overwrite the collection from the DB
// It returns the response from the python script
func handleOverwriteCollection(jsonConfig string, id string) (string, error) {
	log.Println("Overwriting Collection", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/overwrite_collection.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

func handleOverwriteEncodedData(jsonConfig string, id string) (string, error) {

	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/overwrite_encoded_data.py", id)
	if err != nil {
		log.Println("Error executing Python script:", err)
		return "", err
	}

	// Log to verify response
	log.Println("Python script response:", response)

	if response == "" {
		return "", fmt.Errorf("empty response from Python script")
	}

	return response, nil
}

func handleAppendEncodedData(jsonConfig string, id string) (string, error) {
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/append_encoded_data.py", id)
	if err != nil {
		log.Println("Error executing Python script:", err)
		return "", err
	}

	log.Println("Python script response:", response)

	if response == "" {
		return "", fmt.Errorf("empty response from Python script")
	}

	return response, nil
}

// handleCreateGroupDB handles the request to create the group for the DB
// It returns the response from the python script
func handleCreateGroupDB(jsonConfig string, id string) (string, error) {
	log.Println("Create Group DB", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/create_group_DB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}


func handleNormalizeDB(jsonConfig string, id string) (string, error) {
	log.Println("Normalizing DB...", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/input/normalizeDB.py", id)
	Utils.RemoveIdFromScripts(id)
	if err != nil {
		return "", err
	}
	return response, nil
}

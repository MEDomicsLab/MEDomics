import React, {useContext} from "react";
import { Handle } from "reactflow";
import { Tooltip } from "react-tooltip";
import allNodesParams from "../../public/setupVariables/allNodesParams";
import { FlowInfosContext} from "./context/flowInfosContext";
/**
 *
 * @param {Array} arr array of possibles connections
 * @param {Int} i index of the connection
 * @returns % of the position of the connection according to the number of connections
 */
const getConnPositionStyle = (length, i) => {
	return {
		top: `${((i + 1) * 100) / (length + 1)}%`,
	};
};

/**
 * 
 * @param {String} id id of the node
 * @param {Object} setupParam setupParam of the node. found in the config file of the node in /public
 * @param {String} tooltipBy "type" or "node" : the mode of the tooltip. By type will display the possible connections by type of IO (ex: "dataset", "model_config"). By node will display the possible connections by node name(ex: "Dataset", "clean", "split")
 * @description This component is used to display the handlers of the node (connection points)
 * Each handler has a tooltip that displays the possible connections
 */
const Handlers = ({ id, setupParam, tooltipBy="node" }) => {
	const { flowInfos } = useContext(FlowInfosContext);		// used to get the flow infos


	/**
	 * 
	 * @param {string} io input or output : the type of the tooltip to create
	 * @description This function creates the tooltip of the handlers by checking wich mode is wanted (by type or by node)
	 * If the mode is by type, it will display the possible connections by type of IO (ex: "dataset", "model")
	 * If the mode is by node, it will display the possible connections by node name(ex: "Dataset", "clean", "split") 
	 * @returns 
	 */
	const createTooltip = (io) => {
		let listIO = setupParam[io]
		let tooltipKeys = [];
		if(tooltipBy == "node"){
			let completeSetupParam = allNodesParams[flowInfos.type];
			if(io == "input"){
				// we check if the node input type is in the list of possible outputs of all the node and we keep the node name
				Object.keys(completeSetupParam).forEach((key) => {
					let isMember = false;
					listIO.forEach((ioType) => {
						isMember = isMember || completeSetupParam[key]["output"].includes(ioType)
					});
					isMember && tooltipKeys.push(key);
				})
			} else if(io == "output"){
				// we check if the node output type is in the list of possible inputs of all the node and we keep the node name
				Object.keys(completeSetupParam).forEach((key) => {
					let isMember = false;
					listIO.forEach((ioType) => {
						isMember = isMember || completeSetupParam[key]["input"].includes(ioType)
					});
					isMember && tooltipKeys.push(key);
				})
			}
		} else if(tooltipBy == "type"){
			tooltipKeys = listIO;
		}
		return tooltipKeys.join(", ");

	}

	return (
		<>
			{/* We create a handler for each input of the node. */}
			{[...Array(setupParam["nbInput"])].map((x, i) => (
				<div key={`left-${i}_${id}`}>
					<Handle
						id={`${i}_${id}`}
						type="target"
						position={setupParam.type == "flServerNode" ? "top" : "left"}
						style={getConnPositionStyle(setupParam["nbInput"], i)}
						isConnectable
					/>
					<Tooltip
						className="tooltip"
						anchorSelect={`[data-handlepos='left'][data-handleid='${i}_${id}']`}
						delayShow={1000}
						place="left"
					>
						{createTooltip("input")}
					</Tooltip>
				</div>
			))}
			{/* We create a handler for each output of the node. */}
			{[...Array(setupParam["nbOutput"])].map((x, i) => (
				<div key={`right-${i}_${id}`}>
					<Handle
						id={`${i}_${id}`}
						type="source"
						position="right"
						style={getConnPositionStyle(setupParam["nbOutput"], i)}
						isConnectable
					/>
					<Tooltip
						className="tooltip"
						anchorSelect={`[data-handlepos='right'][data-handleid='${i}_${id}']`}
						delayShow={1000}
						place="right"
					>
						{createTooltip("output")}
					</Tooltip>
				</div>
			))}
		</>
	);
};

export default Handlers;

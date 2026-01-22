import Image from "next/image"
import React from "react"
import * as Icon from "react-bootstrap-icons"
import { FaPython } from "react-icons/fa"
import { PiGraph } from "react-icons/pi"
import medomicsImg from "../../../../../resources/medomics.svg"
import DropzoneComponent from "../../../mainPages/dataComponents/dropzoneComponent"
import { collectionExists } from "../../../mongoDB/mongoDBUtils"

const iconExtension = {
  folder: (isExpanded) => (isExpanded ? <span style={{ paddingBottom: "0.15rem" }}>📂</span> : <span style={{ paddingBottom: "0.15rem" }}>📁</span>),
  csv: <span className="emoji">🛢️</span>,
  view: <span className="emoji">👁️</span>,
  json: (
    <span>
      <Icon.Braces className="icon-offset" style={{ color: "yellow" }} />
    </span>
  ),
  txt: (
    <span>
      <Icon.TextLeft className="icon-offset" />
    </span>
  ),
  md: (
    <span>
      <Icon.FiletypeMd className="icon-offset" style={{ color: "white" }} />
    </span>
  ),
  pdf: <span className="emoji">📕</span>,
  html: <span className="emoji">🌐</span>,
  medomics: (
    <span>
      <Image src={medomicsImg} width={12} height={12} alt="medomics.svg" style={{ marginRight: "0.15rem" }} />
    </span>
  ),
  medml: <span className="emoji">🎯</span>,
  medimg: <span className="emoji">🩻</span>,
  medmlres: <span className="emoji">📊</span>,
  medeval: <span className="emoji">🔬</span>,
  zip: <span className="emoji">🔒</span>,
  medmodel: (
    <span>
      <PiGraph className="icon-offset" style={{ color: "#97edfb" }} />
    </span>
  ),
  pkl: (
    <span>
      <PiGraph className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  ),
  ipynb: (
    <span>
      <Icon.JournalCode className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  ),
  png: (
    <span>
      <Icon.Image className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  ),
  jpg: (
    <span>
      <Icon.Image className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  ),
  jpeg: (
    <span>
      <Icon.Image className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  ),
  svg: (
    <span>
      <Icon.Image className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  ),
  rar: (
    <span>
      <Icon.ArchiveFill className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  ),
  py: (
    <span>
      <FaPython className="icon-offset" style={{ color: "#5b95ff" }} />
    </span>
  )

  // 📗📙📘📒📑📈📊🧮🎯💊🧬🔬🧰💾📄🗒️💥🎛️⚙️
}

/**
 * @param {string[]} classNames - list of class names
 * @returns {string} - concatenated class names
 * @abstract - filters out any falsy values and concatenates the rest
 */
const cx = (...classNames) => classNames.filter((cn) => !!cn).join(" ")

/**
 * @abstract - renders a single item in the tree
 * @param {Object} props
 * @param {Object} props.item - the item to render
 * @param {number} props.depth - the depth of the item in the tree
 * @param {React.ReactNode} props.children - the children of the item
 * @param {React.ReactNode} props.title - the title of the item
 * @param {React.ReactNode} props.arrow - the arrow of the item
 * @param {React.ReactNode} props.info - the info of the item
 * @param {Object} props.context - the context object passed by react-contexify
 * @param {Object} additionalParams - additional parameters passed by the tree
 * @param {Function} additionalParams.displayMenu - function to display the context menu
 * @returns {React.ReactNode} - the rendered item
 */
const renderItem = ({ item, depth, children, title, context, arrow }, additionalParams) => {
  const InteractiveComponent = context.isRenaming ? "div" : "button"
  const type = context.isRenaming ? undefined : "button"
  const itemInMongoDB = collectionExists(item.index)

  const folderItemContent = (
    <li
      {...context.itemContainerWithChildrenProps}
      className={cx(
        "rct-tree-item-li",
        item.isFolder && "rct-tree-item-li-isFolder",
        context.isSelected && "rct-tree-item-li-selected",
        context.isExpanded && "rct-tree-item-li-expanded",
        context.isFocused && "rct-tree-item-li-focused",
        context.isDraggingOver && "rct-tree-item-li-dragging-over",
        context.isSearchMatching && "rct-tree-item-li-search-match"
      )}
    >
      <div
        {...context.itemContainerWithoutChildrenProps}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        className={cx(
          "rct-tree-item-title-container",
          item.isFolder && "rct-tree-item-title-container-isFolder",
          context.isSelected && "rct-tree-item-title-container-selected",
          context.isExpanded && "rct-tree-item-title-container-expanded",
          context.isFocused && "rct-tree-item-title-container-focused",
          context.isDraggingOver && "rct-tree-item-title-container-dragging-over",
          context.isSearchMatching && "rct-tree-item-title-container-search-match"
        )}
      >
        {/* if folder is expanded, show the folder bracket */}
        {/* {context.isExpanded && (
          <div
            className="folder-bracket"
            style={{ left: `${(depth + 1) * 12 + 8}px`, backgroundColor: "", width: "1px", transition: "all 0.5s ease-in-out" }}
          ></div>
        )} */}
        {arrow}
        <InteractiveComponent
          type={type}
          {...context.interactiveElementProps}
          className={cx(
            "rct-tree-item-button",
            item.isFolder && "rct-tree-item-button-isFolder",
            context.isSelected && "rct-tree-item-button-selected",
            context.isExpanded && "rct-tree-item-button-expanded",
            context.isFocused && "rct-tree-item-button-focused",
            context.isDraggingOver && "rct-tree-item-button-dragging-over",
            context.isSearchMatching && "rct-tree-item-button-search-match"
          )}
          data={item}
          onContextMenu={(e) => {
            console.log("onContextMenu", item.index, e, additionalParams, item)
            // additionalParams.setSelectedItems([item.UUID])
            additionalParams.displayMenu(e, item)
          }}
        >
          <div>
            {iconExtension.folder(context.isExpanded)}
            <span className="label">{title}</span>
          </div>
        </InteractiveComponent>
      </div>
      {children}
    </li>
  )

  return (
    <>
      {/* If the item is a folder, we render it as a dropzone */}
      {item.isFolder && (
        <>
          {additionalParams.isHovering && !additionalParams.isDropping ? (
            <div className="sidebar-dropzone-dirtree" style={{ display: "block", boxSizing: "border-box" }}>
              {folderItemContent}
            </div>
          ) : (
            <DropzoneComponent className="sidebar-dropzone-dirtree" item={item} noClick={true} setIsDropping={additionalParams.setIsDropping}>
              {folderItemContent}
            </DropzoneComponent>
          )}
        </>
      )}
      {!item.isFolder && (
        <>
          <li
            {...context.itemContainerWithChildrenProps}
            className={cx(
              "rct-tree-item-li",
              item.isFolder && "rct-tree-item-li-isFolder",
              context.isSelected && "rct-tree-item-li-selected",
              context.isExpanded && "rct-tree-item-li-expanded",
              context.isFocused && "rct-tree-item-li-focused",
              context.isDraggingOver && "rct-tree-item-li-dragging-over",
              context.isSearchMatching && "rct-tree-item-li-search-match"
            )}
          >
            <div
              {...context.itemContainerWithoutChildrenProps}
              style={{ paddingLeft: `${(depth + 1) * 10}px` }}
              className={cx(
                "rct-tree-item-title-container",
                item.isFolder && "rct-tree-item-title-container-isFolder",
                context.isSelected && "rct-tree-item-title-container-selected",
                context.isExpanded && "rct-tree-item-title-container-expanded",
                context.isFocused && "rct-tree-item-title-container-focused",
                context.isDraggingOver && "rct-tree-item-title-container-dragging-over",
                context.isSearchMatching && "rct-tree-item-title-container-search-match"
              )}
            >
              {/* {arrow} */}

              <InteractiveComponent
                type={type}
                {...context.interactiveElementProps}
                className={cx(
                  "rct-tree-item-button",
                  item.isFolder && "rct-tree-item-button-isFolder",
                  context.isSelected && "rct-tree-item-button-selected",
                  context.isExpanded && "rct-tree-item-button-expanded",
                  context.isFocused && "rct-tree-item-button-focused",
                  context.isDraggingOver && "rct-tree-item-button-dragging-over",
                  context.isSearchMatching && "rct-tree-item-button-search-match",
                  !item.isFolder && "rct-tree-item-isNotFolder"
                )}
                data={item}
                onContextMenu={(e) => {
                  console.log("onContextMenu", title)
                  additionalParams.displayMenu(e, item)
                }}
                onDoubleClick={(e) => {
                  console.log("onDoubleClick", title, item)
                  additionalParams.onDBClickItem(e, item)
                }}
              >
                <div>
                  {iconExtension[item.type]}
                  <span className="label">{title}</span>
                  {item.isLocked && (
                    <span className="emoji" title={`This item is used in ${additionalParams.dirTree[item.usedIn] ? additionalParams.dirTree[item.usedIn].data : "a generated notebook"}`}>
                      🔒
                    </span>
                  )}
                  {additionalParams.showMongoDetails && itemInMongoDB && <img src="https://cdn3.emoji.gg/emojis/21146-mongodb.png" width="16px" height="16px" alt="mongodb" />}
                  {additionalParams.showMongoDetails && item.path && <img src="https://www.freeiconspng.com/uploads/floppy-save-icon--23.png" width="16px" height="16px" alt="local" />}
                </div>
              </InteractiveComponent>
            </div>
            {children}
          </li>
        </>
      )}
    </>
  )
}

export default renderItem

import React from "react"
import { Image } from "react-bootstrap"
import { shell } from "electron"

/**
 * @param {string} link - Link to the documentation
 * @param {string} name - Name of the documentation
 * @param {string} image - Image to display next to the documentation
 * @returns {JSX.Element} - A link to the documentation
 *
 * @description
 * This component is used to display a link to the documentation
 * of a specific extraction method.
 */
const DocLink = ({ linkString, name, image }) => {
  /**
   * @param {Event} event - Click event
   *
   * @description
   * This function is used to handle the click event on the link
   * it opens the link in the default browser
   */
  const handleLinkClick = (event) => {
    event.preventDefault()
    shell.openExternal(linkString)
  }

  return (
    <>
      <p className="docLink">
        {image && <Image className="docLink-image" alt="docLink image" />}
        <a href={linkString} onClick={handleLinkClick}>
          {name}
        </a>
      </p>
    </>
  )
}

export default DocLink

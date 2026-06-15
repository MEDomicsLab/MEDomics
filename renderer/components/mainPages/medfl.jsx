import MedflowWelcomePage from "./medflWelcomePage"
import ModulePage from "./moduleBasics/modulePage"

const MEDflPage = ({ pageId }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow={true}>
        <MedflowWelcomePage />
      </ModulePage>
    </>
  )
}

export default MEDflPage

class MEDDataObject:

    """ This class define a MEDDataObject in the bakend, which is the same as the one described in the frontend"""

    def __init__(self, id, name, type, parentID, childrenIDs, inWorkspace) -> None:
        self.id = id
        self.name = name
        self.type = type
        self.parentID = parentID
        self.childrenIDs = childrenIDs
        self.inWorkspace = inWorkspace
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'parentID': self.parentID,
            'childrenIDs': self.childrenIDs,
            'inWorkspace': self.inWorkspace
        }
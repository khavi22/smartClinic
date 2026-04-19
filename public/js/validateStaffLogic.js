//validateStaffData  for Browser
// ES Module format 
// Used by browsers
function validateStaffData(snapshot) {
    if (!snapshot.empty) {
        const Staff_Data = snapshot.docs[0].data();
        return Staff_Data;
    } else {
        return null;
    }
}

export { validateStaffData };


const admin = require("firebase-admin");
const db = admin.firestore();


async function SaveAvailability(StaffCode,StartTime,EndTime,selectedDates,Available){
        const StaffCode="STF-330AFB";
     
        const snaphshot =  await  db.collection("staff")
                            .where("staffCode" , "==",staffCode)
                            .get();
     
        if(snaphshot.empty){
                alert("Staff member not found");
                return;
            }
        console.log("staff member found")
        //get reference
        const StaffClinicsRef= snaphshot.docs[0].ref;
     
        const AvailabilityUpdate={};
     
        for(const date  of selectedDates){
            AvailabilityUpdate[`Staff_Availability.${date}`]={
                Available:Available,
                startTime:StartTime,
                endTime:EndTime,
                };
            console.log("Field successfully added!");
           }
      await StaffClinicsRef.updateDoc(AvailabilityUpdate);
      return{success:true};

}

async function getAvailability(staffCode){
           const staffCode="STF-330AFB";
    
            const q = query(
                            collection(db, "staff"),
                            where("staffCode" , "==",staffCode).get()
                        )
             const snapshots= await  db.collection("staff")
                   .where("staffCode" , "==",staffCode)
                   .get();
    
             if(snapshots.empty){
                console.log("staff not found");
                return;
             }
    
            const getStaffData = snapshots.docs[0].data();
            getStaffData.Staff_Availability || {};
}

async function removeStaffAvailability(staffCode, date){
  const snapshots= await  db.collection("staff")
                    .where("staffCode" , "==",staffCode)
                    .get();


    const StaffClinicsRef= snaphshots.docs[0].ref;

    await StaffClinicsRef.updateDoc({
                [`Staff_Availability.${date}`]: admin.firestore.FieldValue.delete
            });
    return { success: true };
}

module.exports = {SaveAvailability,getAvailability,removeStaffAvailability};
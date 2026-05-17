const { db, admin } = require("./config/firebase");
// console.log("DB",db);


async function SaveAvailability(StaffCode,StartTime,EndTime,selectedDates,Available){
        //StaffCode="STF-330AFB";
        const snaphshot =  await  db.collection("staff")
                            .where("uid" , "==",StaffCode)
                            .get();
     
        if(snaphshot.empty){
               throw new Error("Staff member not found");
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
      await StaffClinicsRef.update(AvailabilityUpdate);
      return{success:true};

}

async function getAvailability(staffCode){
        //    const staffCode="STF-330AFB";
             const snapshots= await  db.collection("staff")
                   .where("uid" , "==",staffCode)
                   .get();
    
             if(snapshots.empty){
                console.log("staff not found");
                return;
             }
    
            const getStaffData = snapshots.docs[0].data();
            return getStaffData.Staff_Availability || {};
}

async function removeAvailability(staffCode, date){
  const snapshots= await  db.collection("staff")
                    .where("uid" ,"==",staffCode)
                    .get();
    const StaffClinicsRef= snapshots.docs[0].ref;

    await StaffClinicsRef.update({
                [`Staff_Availability.${date}`]: admin.firestore.FieldValue.delete()
            });
    return { success: true };
}
async function getClinicName(uid) {
    const staffSnapshot = await db.collection("staff")
        .where("uid", "==", uid)
        .get();

    if (staffSnapshot.empty) return null;

    const staffData = staffSnapshot.docs[0].data();
    const clinicId = staffData.clinicId;

    const clinicDoc = await db.collection("clinics").doc(clinicId).get();

    if (!clinicDoc.exists) return null;

    return clinicDoc.data().clinicName;
}

module.exports = {SaveAvailability, getAvailability, removeAvailability, getClinicName};
// module.exports = {SaveAvailability,getAvailability,removeAvailability};
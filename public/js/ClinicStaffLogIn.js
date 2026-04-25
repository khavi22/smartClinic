import {db} from './ClinicStaffFirebase.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

console.log("JS file loaded!");

import { validateStaffData } from './validateStaffLogic.js';

async function validateStaffNumber(StaffNumber){
    console.log("hi");
    const q_staff_number=query(collection(db,"ClinicStaff") , 
                              where("StaffNumber","==",StaffNumber) 
                              );

    const snapshot_firebase = await getDocs(q_staff_number);

    return validateStaffData(snapshot_firebase);
}


const verify_button=document.getElementById("verify-button-staff-number");
const invalid_section=document.getElementById("invalid_staff_number_section");
verify_button.addEventListener("click" , async function(){
    console.log("Button clicked!");
    invalid_section.innerHTML="";
    const staffNumber = document.getElementById("Staff_Code").value;

    const Staff_isValid= await validateStaffNumber(Number(staffNumber));

    console.log(Staff_isValid);

    if(Staff_isValid){

    verify_button.style.display = "none";
    
    // if the staff code is valid show success button
    //document.getElementById("success-btn").style.display = "block";
    GoToClinicStaffDashboard();
    }
    else{
        const paragraph=document.createElement("p");
        paragraph.textContent="Invalid Staff Number was entered"
        invalid_section.appendChild(paragraph);
    }


 
   document.getElementById("Staff_Code").value="";

})

function GoToClinicStaffDashboard(){
    window.location.href="ClinicStaffDashBoard.html";
}


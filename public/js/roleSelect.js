document.getElementById("role").addEventListener("change", function(){
    const selectedRole = this.value;
    
    if(selectedRole === "Staff"){
        window.location.href = "ClinicStaffLogIn.html";
    }
    // } else if(selectedRole === "Patient"){
    //     window.location.href = "";
    // } else if(selectedRole === "Admin"){
    //     window.location.href = "";
    // }
});
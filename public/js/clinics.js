// use this script to test the clincs mzo
const search_button_ByName = document.getElementById("Butt_SearchByName");
const search_button_ByLocation = document.getElementById("Butt_UseLocation");
const section_card=document.getElementById("card_view_clinics");
const section_view_clinics = document.getElementById("search_clinic_section");
search_button_ByName.addEventListener("click", async function () {
    const input_value = document.getElementById("search_input").value;
    const response = await fetch(`http://localhost:3000/api/clinics?search=${input_value}`);
    const data = await response.json();
    console.log(data);
    
    // const arr=[];
    const arr=data.places;
    const pa=document.createElement("p");
    section_view_clinics.innerHTML="";
    for(let i=0;i<arr.length;i++){
        const card=document.createElement("section");
        card.classList.add("card_view_clinics");
        card.innerHTML=`
        <h2 class="Clinic_Name">${arr[i].displayName.text}</h2>
        <p class="Clinic_address">${arr[i].formattedAddress}</p>
        `
       ;
       section_view_clinics.appendChild(card);
       document.getElementById("search_input").value="";
        
    }

})

search_button_ByLocation.addEventListener("click", async function () {
    navigator.geolocation.getCurrentPosition(async function (position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        const response = await fetch(`http://localhost:3000/api/clinics?lat=${latitude}&lon=${longitude}`);
        const data = await response.json()
        console.log(data);


    const arr=data.places;
    const pa=document.createElement("p");
    section_view_clinics.innerHTML="";
    for(let i=0;i<arr.length;i++){
        const card=document.createElement("section");
        card.classList.add("card_view_clinics");
        card.innerHTML=`
        <h2 class="Clinic_Name">${arr[i].displayName.text}</h2>
        <p class="Clinic_address">${arr[i].formattedAddress}</p>
        `
       ;
    
       section_view_clinics.appendChild(card);
        
    }
    });

});

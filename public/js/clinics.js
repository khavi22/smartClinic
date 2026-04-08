// fetch("/api/clinics")
//     .then(res => res.json())
//     .then(data => {
//     console.log(data);
// });
// use this script to test the clincs mzo
const search_button_ByName=document.getElementById("Butt_SearchByName");
const search_button_ByLocation=document.getElementById("Butt_UseLocation");

search_button_ByName.addEventListener("click",async function(){
    const input_value  = document.getElementById("search_input").value;
    const response =  await fetch(`http://localhost:3000/api/clinics?search=${input_value}`);
    const data = await response.json();
    console.log(data);
})

search_button_ByLocation.addEventListener("click",async function(){
    navigator.geolocation.getCurrentPosition(async function(position){
        const latitude= position.coords.latitude;
        const longitude = position.coords.longitude;

        const response = await fetch(`http://localhost:3000/api/clinics?lat=${latitude}&lon=${longitude}`);
        const data = await response.json()
        console.log(data);
    });
    
});

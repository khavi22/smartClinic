fetch("/api/clinics")
    .then(res => res.json())
    .then(data => {
    console.log(data);
});
// use this script to test the clincs mzo
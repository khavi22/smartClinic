firebase.auth().onAuthStateChanged(async function(user) {
    if (user) {

        // const patientId = user.uid;
        const patientId =  "30FNnDM7W6MPuB7SjfZNUhBSqcH2";
        await loadQueueInfo(patientId);
        // aim to refresh the page every 30 seconds to  get  real time updates
        setInterval(async function() {
            await loadQueueInfo(patientId);
        }, 30000);
    } else {
        //window.location.href = "/patientQueue.html";
    }
});



async function  loadQueueInfo(patientId){
    try{
        const response = await fetch(`/api/patient/queue/${patientId}`);
        const data = await response.json();

        if (response.ok){
            displayQueueInfo(data.queueInfo)
        }

        else {
            document.getElementById("loading-msg").style.display = "none";
            document.getElementById("not-in-queue").style.display = "block";
        }
    }
    catch (error) {
        console.error("Error loading queue info:", error);
    }
}

function displayQueueInfo(queueInfo) {
    document.getElementById("loading-msg").style.display = "none";
    document.getElementById("queue-info").style.display = "block";

    document.getElementById("clinic-name").textContent = queueInfo.clinicName;
    document.getElementById("clinic-address").textContent = queueInfo.clinicAddress;
    document.getElementById("appointment-time").textContent = "Appointment Time: " + queueInfo.appointmentTime;
    document.getElementById("queue-position").textContent = "You are number " + queueInfo.position + " in the queue";
    document.getElementById("queue-total").textContent = queueInfo.totalInQueue + " patients in queue today";
    document.getElementById("estimated-wait").textContent = "Estimated wait time: " + queueInfo.estimatedWaitTime + " minutes";
}
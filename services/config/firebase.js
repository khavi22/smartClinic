const admin = require("firebase-admin");

    const serviceAccount = {
        type: "service_account",
        project_id: "smartclinic-11971",
        private_key_id: "32fe250b80b18310e9e84e7f7bf3ab18f7b98671",
        private_key: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDXvtmgoZo7Uw+e
H76sNyru/yns9HUYoTN4iKtPOhv9UYNvGihyPnIWOSaJloo/z5Moa0ijCiXgUwH9
ziBOqShqdXxT4zzkQlrqRsoaS35zL8BVEmIl+TmD6ATZZZEFfrDqf2J5Dhy0rDa6
ribs9RSoQ0VDwaQNAhzErAFNr17PB4uXlHv06pm5QXNLOmguRHbaWTQW7mpGpLhu
7BIdCDyrk69pJ/NAi6H76PFSCirFjcx3iUR0A0h1Htce1psBXtg6RiffaiTO/8sj
rJdpPmhzbFg07lbUBKmbfC0DNalOLHGD8u80EcuKZIXPpFNODKgmERJ3+Iz8IexY
ifaN9GnxAgMBAAECggEAaq7GAKdIk+NLyr4Z1CDniw0EF1b+fDJiOE0koOW0J3xi
SNMfgvacBZ83DjwxmsIzG36JiY2gEyAY0P9XfG4rPRFhbD3mw1yIhmaA06XXHnBT
Y/3WKL7nkPFvTGzr3FK8ewiIkiHHUhQCcCdjujKqh1XUb1/WllQgE6SWdGqusCI7
l9nEWsYALHMmBJ0E39/DZ9bb5CnVniFE9CCCModHjl0f/u+yZWvdzhuMRneqU+UY
RQW3TPdSAugkQU3TFC5wnWetsqWlQaKyRSDO880h32iT07YHyANuORoVBU5BXAG1
aEjCGUBbHxW8l1RtRldpuIp04uEO7ZKR/S4i5qsfvQKBgQDsrVOpUB7VjCVNJ/Iu
hy2V3zChQQdnzeGLLhHN48Oi9Ms/v/EiAELQ6NdrnmHVRm+VZxlfvj7gbhSNIIVc
XEk/FVNVpIvbzyzk6n/TakQfzbdgK2MuUxrTM6WDbAORcnDf0pTOnOH2bRlSRsi3
SyVBEWJCMX/4Utbqq2XBOn5UBwKBgQDpXAsGgfzi0J6nQ/BAkMy9U2TlgQIhZg6l
8G6HuZF+aHxAEuFxzt5sj6QmeQ0qSB5A18gi7+cf/WrX++I4wnlzKiTjOieV7DWs
/h4MU8E2Vv4Ru28mh0FMmh/f02FHm+FZaqpk6+HKQ9AfDvnUB1qTyNqY56M7Vhtm
SWSi3s0ERwKBgC2xxR5CTsGx/h2oYbSj+qQd5Dit4m0jLbF+YoeautHCa19Sgo6q
+Dt3SOgJOyA/KhnxPs/iXidceXFJ3xWW57lbN6yoSSxWEnfb4nQB50cwo3/YwJxY
BSzTotf9ya6SJsK/2GUPmvzF0Ya2Ddh9lKK8ZXkcL3XVIJNMJigpT+yPAoGAZDEa
or6ovxFnLNWkj3QcE6V8inUrXv+chm6GZkusRiPCRRhWJzD0mpPJnKMYnfC83IZI
7YcnKrr5ZqZE6K3Gy0Vq9QyA9oOmQBITAKPtLtGG4EIjZN1pkeQSj10IRWCODoAX
jKEiHl+jOdKKPRizMQRppoC9urorpW0Zgjw6tf0CgYA0/XQDdsMIuWJWkoWhaq8W
LODqbXTKS85xJxw+CFrjz9B6j6u+7GWuC+S++pGTvBwRlD4tJ1MQ0ONB6IImfn98
ETdJNyU+Ec80OmLnUgb+w0qk4vh/OQyYH3+GsA8fKUmee6xvXC2/yrgGU6Ub+/Wy
HijTIW3z/E2h/ZAkNVYQ/Q==
-----END PRIVATE KEY-----\n`,
        client_email: "firebase-adminsdk-fbsvc@smartclinic-11971.iam.gserviceaccount.com",
        client_id: "111145842828731529653",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40smartclinic-11971.iam.gserviceaccount.com"
    };

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

const db = admin.firestore();

module.exports = { admin, db };
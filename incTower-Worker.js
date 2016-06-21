/**
 * Created by Mo on 4/24/2015.
 */
self.addEventListener('message', function(e) {
    var data = e.data;
    switch (data.cmd) {
        case 'start':
            console.log("attempting start");
            setInterval(function () {
                self.postMessage('update');
            },1000);
            break;
        case 'stop':
            self.postMessage('WORKER STOPPED: ' + data.msg +
            '. (buttons will no longer work)');
            self.close(); // Terminates the worker.
            break;
        default:
            self.postMessage('Unknown command: ' + data.msg);
    }
}, false);
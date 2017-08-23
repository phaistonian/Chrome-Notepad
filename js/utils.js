var Utils = {
    getDT: function(timestamp) {
        var string = 'N/A';
        var days, hours, minutes, seconds, diff;

        if (timestamp) {
            diff = Math.round((new Date().getTime() - timestamp) / 1000),
                hours = Math.round(diff / 3600);

            if (diff == 0) {
                string = 'Just now'
            } else if (diff < 60) {
                string = diff + ' second' + (diff > 1 ? 's' : '') + ' ago'
            } else if (diff > 60 && diff < 3600) {
                minutes = Math.round(diff / 60);
                seconds = diff % 60;
                string = Math.round(diff / 60) + ' minute' + (Math.round(diff / 60) > 1 ? 's' : '') + ' ago';
            } else if (diff > 3600 && hours < 48) {
                string = hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
            } else {
                string = 'Long time ago'
            }
        }

        return string;
    },
    encodePercentSymbol: function (str) {
        return str.replace(/%/g, "%25");
    },
    encodeURIComponent: function (str) {
        return str;
    },
    removeLineBreaks: function (inStr) {
        return decodeURIComponent(Utils.encodeURIComponent(inStr.replace(/<br \/>/g, "\n")));
    },
    addLineBreaks: function (inStr) {
        return inStr.replace(/\r\n?|\n/g, "<br />");
    },
    trackGoogleEvent: function (eventType) {
        if (eventType == "NOTE_CREATION") {
            _gaq.push(['_trackEvent', "NoteCreated", 'clicked', "NoteCreated"]);
        } else if (eventType == "NOTE_SOFT_DELETION") {
            _gaq.push(['_trackEvent', "NoteDeleted", 'clicked', "NoteDeleted"]);
        } else if (eventType == "NOTE_HARD_DELETION") {
            _gaq.push(['_trackEvent', "NoteDeletetedForever", 'clicked', "NoteDeletetedForever"]);
        } else if (eventType == "NOTE_RESTORATION") {
            _gaq.push(['_trackEvent', "NoteRestored", 'clicked', "NoteRestored"]);
        } else if (eventType == "NOTE_BIN_VISITED") {
            _gaq.push(['_trackEvent', "NoteBinVisited", 'clicked', "NoteBinVisited"]);
        } else if (eventType == "NOTE_FULL_MODE") {
            _gaq.push(['_trackEvent', "NoteFullMode", 'clicked', "NoteFullMode"]);
        } else if(eventType == "NOTE_REORDERED") {
            _gaq.push(['_trackEvent', "NoteReordered", 'clicked', "NoteReordered"]);
        }
    }
};
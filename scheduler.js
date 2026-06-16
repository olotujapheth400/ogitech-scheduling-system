// FIFO (First-In, First-Out) Scheduling Logic
function fifo(jobs) {
    return [...jobs]; // Returns the array exactly in the chronological order it arrived
}

// SJF (Shortest Job First) Scheduling Logic
function sjf(jobs) {
    return [...jobs].sort((a, b) => {
        // Sort primarily by cooking/burst time (Shortest job gets executed first)
        if (a.processingTime !== b.processingTime) {
            return a.processingTime - b.processingTime;
        }
        // If burst times are identical, break the tie using arrival time sequence (id)
        return a.id - b.id;
    });
}

module.exports = { fifo, sjf };
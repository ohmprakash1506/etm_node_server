const { WaitingReports } = require('../../models/waitingReports');
const { Server } = require('socket.io');

const waitingSocket = async (server) => {
  const io2 = new Server(server, {
    path: '/waiting',
    cors: {
      origin: '*',
      credentials: true,
    },
  });
  io2.on('connection', (socket) => {
    socket.on('startTimer', async (data) => {
      const driverId = data.driverId;
      const employeeId = data.employeeId;
      const tripId = data.tripid;
      const minutes = data.minutes;
      let seconds = minutes * 60;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + seconds * 1000);

      const waitingReport = new WaitingReports({
        driverId: driverId,
        employeeId: employeeId,
        tripId: tripId,
        locationReachedTime: startTime,
        locationExitingTime: endTime,
        passangerBoarded: false,
      });

      try {
        await waitingReport.save();
      } catch (error) {
        console.error('Error saving waiting report:', error);
      }
      socket.emit('timerInfo', {
        startTime: startTime.toLocaleTimeString(),
        endTime: endTime.toLocaleTimeString(),
      });

      const interval = setInterval(() => {
        let min = Math.floor(seconds / 60);
        let sec = seconds % 60;

        socket.emit('timerUpdate', {
          time: `${min}:${sec < 10 ? '0' : ''}${sec}`,
        });

        if (seconds > 0) {
          seconds--;
        } else {
          clearInterval(interval);
          socket.emit('timerEnd', {
            currentTime: new Date().toLocaleTimeString(),
          });
        }
      }, 1000);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  return io2;
};

const getWaitingReport = async (req, res) => {
  let roleName = req.auth.userRole;
}

module.exports = { waitingSocket };

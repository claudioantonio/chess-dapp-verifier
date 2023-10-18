// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers } = require('ethers');
const { Chess } = require('chess.js');

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

const SHARDING_CONTRACT_ADDRESS = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

var game = new Chess();
var moveCounter = 0;
var currentPlayer;
var winner;

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));

  const sender = data["metadata"]["msg_sender"];
  const payload = ethers.toUtf8String(data["payload"]);

  if (sender==SHARDING_CONTRACT_ADDRESS) {
    const mainDappAddress = payload;
    //TODO To create a voucher
    console.log("Creating voucher for " + winner);
  } else {
    moveCounter++;
    currentPlayer = moveCounter % 2 == 0 ? "w" : "b";

    try {
      game.move(payload);  
      if (game.isGameOver()) {
        winner=currentPlayer;
        console.log("Game is over with valid move");
      }
    } catch(illegal_move) {
      winner=getAdversary(currentPlayer);
      console.log("Game over by invalid move from " + currentPlayer);
      return "reject";
    }
  }

  return "accept";
}

function getAdversary(player) {
  return player == "w" ? "b" : "w";
}

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));
  return "accept";
}

var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();

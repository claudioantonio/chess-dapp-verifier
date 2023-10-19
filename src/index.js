// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers, AbiCoder } = require('ethers');
const { Chess } = require('chess.js');

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

const SHARDING_CONTRACT_ADDRESS = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const TRANSFER_FUNCTION_SELECTOR = "0xa9059cbb";
const FIRST_MOVE = 0;
const SECOND_MOVE = 1;

var game = new Chess();
var moveCounter = 0;
var player1;
var player2;
var winner;

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));

  const sender = data["metadata"]["msg_sender"];
  const payload = ethers.toUtf8String(data["payload"]);

  if (sender.toLowerCase()==SHARDING_CONTRACT_ADDRESS.toLowerCase()) {
    console.log("Received Sharding call");

    const mainDappAddress = payload;
    if (game.isGameOver()) {
      console.log("Creating voucher for " + winner);
      await emitVoucher(mainDappAddress,winner,1);
    } else {
      // TODO cover use cases when dispute is requested during the game
      await emitVoucher(mainDappAddress,winner,1);
    }

  } else {
    console.log("Received a move");

    if (moveCounter==FIRST_MOVE) {
      player1 = sender;
    } else if (moveCounter==SECOND_MOVE) {
      if (sender.toLowerCase()==player1.toLowerCase()) {
        console.log("Player 1 cannot play twice in a row");
        return "reject";
      }
      player2 = sender;
    }
    moveCounter++;

    try {
      game.move(payload);  
      if (game.isGameOver()) {
        winner=sender;
        console.log("Game is over with valid move");
      }
    } catch(illegal_move) {
      winner=getAdversary(sender);
      console.log("Game is over by invalid move from " + sender);
      return "reject";
    }
  }

  return "accept";
}

function getAdversary(player) {
  return player.toLowerCase() == player1.toLowerCase() ? player2 : player1;
}

async function emitVoucher(dappAddress, recipient, amount) {
  const types = ['address','uint256'];
  const values = [recipient, amount];
  const methodSignature = AbiCoder.defaultAbiCoder().encode(types, values);
  const transferPayload = TRANSFER_FUNCTION_SELECTOR + methodSignature.slice(2);
  voucher = {"destination": dappAddress, "payload": transferPayload};

  const voucher_req = await fetch(rollup_server + '/voucher', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(voucher),
  });
  const json = await voucher_req.json();
  console.log("Voucher status " + voucher_req.status + " with body " + JSON.stringify(json));
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

// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers, AbiCoder } = require('ethers');
const { Chess } = require('chess.js');

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

const SHARDING_CONTRACT_ADDRESS = "0x4753D5746881907764A789Dd67FD62e3573844Ea";
const INPUTBOX_CONTRACT_ADDRESS = "0x59b22D57D4f067708AB0c00552767405926dc768";
const INPUTBOX_ADDINPUT_SELECTOR = "0x1789cd63";

var game = new Chess();
var winner;

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));

  const sender = data["metadata"]["msg_sender"];

  if (sender.toLowerCase()==SHARDING_CONTRACT_ADDRESS.toLowerCase()) {
    console.log("Received Sharding call");

    const mainDappAddress = data["payload"];
    if (game.isGameOver()) {
      console.log("Creating voucher for " + winner);
      await emitVoucher(
        INPUTBOX_CONTRACT_ADDRESS,
        INPUTBOX_ADDINPUT_SELECTOR,
        mainDappAddress,
        winner
        );
    } else {
      if (winner==null) {
        console.log("Game is not over yet and no illegal move was provided. Why are you calling me?");
      } else {
        await emitVoucher(
          INPUTBOX_CONTRACT_ADDRESS,
          INPUTBOX_ADDINPUT_SELECTOR,
          mainDappAddress,
          winner
        );
      }
    }

  } else {
    console.log("Received a move");

    if (game.isGameOver()) return "reject"

    const payload = ethers.toUtf8String(data["payload"]);
    var currentPlayer = game.turn();
    try {
      game.move(payload);  
    } catch(illegal_move) {
      winner = getAdversary(currentPlayer);
      console.log("Game is over by invalid move from " + currentPlayer);
      return "reject";
    }

    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        winner = currentPlayer;
        console.log("Game over in checkmate. Winner is " + currentPlayer);
      } else {
        console.log("Game over in draw.");
        winner="d";
      }  
    }
  }

  return "accept";
}

function getAdversary(player) {
  return player.toLowerCase() == "w" ? "b" : "w";
}

async function emitVoucher(inputBoxAddress, addInputSelector, mainDappAddress, winner) {
  const types = ['address','bytes'];
  const values = [mainDappAddress,  ethers.toUtf8Bytes(winner)];
  const methodSignature = AbiCoder.defaultAbiCoder().encode(types, values);
  const transferPayload = addInputSelector + methodSignature.slice(2);
  voucher = {"destination": inputBoxAddress, "payload": transferPayload};

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

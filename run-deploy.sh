#!/bin/sh
# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

# Use docker-compose to start the Cartesi Rollups environment for a given DApp in production mode

if [ ! $1 ]; then
  echo "Usage: "$0" <network>"
  echo "where:"
  echo "- <network> must match a supported network name (e.g., 'sepolia')"
  echo "notes:"
  echo "- this requires environment variables defining the MNEMONIC and RPC_URL to use"
  exit 1
fi

network=$1

DAPP_NAME=$dapp docker compose --env-file ./testnet/env.$network -f ./testnet/deploy.yml up
DAPP_NAME=$dapp docker compose --env-file ./testnet/env.$network -f ./testnet/deploy.yml down -v

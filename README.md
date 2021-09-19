# Opium Protocol basic option contract

## Intro

The purpose of the repo is to showcase the workflow of a very basic call option built on top of the Opium Protocol

## Quickstart

After cloning the repository, run the following commands:

1. Set your INFURA_API_KEY environment variable in a .env file
2. Set your MNEMONIC environment variable in a .env file
3. yarn install
4. yarn test

### Basic life-cycle of the option contract

1. create call option
2. push data (underlying's current market price) into the oracle
3. time-travel after the option's maturity date and execute the option contract

## License

[MIT](https://choosealicense.com/licenses/mit/)

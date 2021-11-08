#!/usr/bin/env node
import "source-map-support/register";
import "dotenv/config";
import * as cdk from "@aws-cdk/core";
import { HasuraRdsStack } from "../lib/hasura-rds-stack";
import { VPCStack } from "../lib/vpc-stack";

const app = new cdk.App();

const appName = process.env.APP_NAME;
if (!appName) {
    throw Error("APP_NAME must be defined in environment");
}

const region = process.env.REGION;
if (!region) {
    throw Error("AWS_REGION must be defined in environment");
}

const account = process.env.ACCOUNT;
if (!account) {
    throw Error("AWS_ACCOUNT_ID must be defined in environment");
}

const env = {
    region,
    account,
};

const vpcStack = new VPCStack(app, `${appName}-HasuraVPCStack`, { env });

new HasuraRdsStack(app, `${appName}-HasuraStack`, {
    env,
    appName,
    vpc: vpcStack.vpc,
});

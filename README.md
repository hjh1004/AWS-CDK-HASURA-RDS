## Description

This is a hasura backend project for TypeScript development with AWS CDK using VPC and ECS and RDS.

## Prerequisites

-   AWS CLI
-   AWS ECR - Hasura docker iamge

## Configuration

.env

```
APP_NAME=Udemy
ACCOUNT=700000000000
REGION=ap-northeast-2
VPC_CIDR=172.30.0.0/16
```

## Useful commands

```bash
# emits the synthesized CloudFormation template
$ cdk synth

# compare deployed stack with current state
$ cdk diff

# deploy this stack to your default AWS account
$ cdk deploy
```

## After deploy

You can use hasura console with admin secret from secrets manager

## Reference repository

-   https://github.com/lineupninja/hasura-cdk
-   https://github.com/cheslip/aws-cdk-hasura

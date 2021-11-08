import { StackProps, Stack, Construct } from "@aws-cdk/core";
import { Vpc, SubnetType } from "@aws-cdk/aws-ec2";

export type VPCStackProps = StackProps;

export class VPCStack extends Stack {
    readonly vpc: Vpc;

    constructor(scope: Construct, id: string, props: VPCStackProps) {
        super(scope, id, props);

        const vpc = new Vpc(this, "HasuraVpc", {
            cidr: process.env.VPC_CIDR,
            natGateways: 1,
            maxAzs: 3,
            subnetConfiguration: [
                {
                    cidrMask: 20,
                    name: "public",
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 20,
                    name: "application",
                    subnetType: SubnetType.PRIVATE_WITH_NAT,
                },
                {
                    cidrMask: 20,
                    name: "data",
                    subnetType: SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });
        this.vpc = vpc;
    }
}

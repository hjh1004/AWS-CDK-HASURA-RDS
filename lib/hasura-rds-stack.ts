import { StackProps, Stack, Construct } from "@aws-cdk/core";
import {
    Vpc,
    InstanceType,
    InstanceClass,
    InstanceSize,
    Port,
} from "@aws-cdk/aws-ec2";
import { ApplicationLoadBalancedFargateService } from "@aws-cdk/aws-ecs-patterns";
import { ContainerImage, Secret as ECSSecret, Cluster } from "@aws-cdk/aws-ecs";
import {
    DatabaseInstance,
    DatabaseInstanceEngine,
    DatabaseSecret,
    PostgresEngineVersion,
} from "@aws-cdk/aws-rds";
import { Secret, CfnSecret, ISecret } from "@aws-cdk/aws-secretsmanager";

export interface HasuraStackProps extends StackProps {
    appName: string;
    vpc: Vpc;
    hasuraOptions?: {
        version?: string;
        imageName?: string;
        enableTelemetry?: boolean;
        adminSecret?: ISecret;
        jwtSecret?: ISecret;
        env?: {
            [x: string]: string;
        };
        secrets?: {
            [x: string]: Secret;
        };
    };
}

export class HasuraRdsStack extends Stack {
    public readonly connectionSecret: CfnSecret;
    public readonly service: ApplicationLoadBalancedFargateService;
    public readonly postgres: DatabaseInstance;
    public readonly passwordSecret?: Secret;
    constructor(
        scope: Construct,
        id: string,
        public readonly props: HasuraStackProps
    ) {
        super(scope, id, props);

        const hasuraDatabaseName = props.appName;
        const hasuraUsername = "hasura";

        // setup password secret
        this.passwordSecret = new Secret(this, "DatabasePassword", {
            generateSecretString: {
                excludePunctuation: true,
            },
        });
        const databasePassword = this.passwordSecret.secretValue;

        // postgres database instance
        this.postgres = new DatabaseInstance(this, "Instance", {
            databaseName: hasuraDatabaseName,
            engine: DatabaseInstanceEngine.postgres({
                version: PostgresEngineVersion.VER_12_3,
            }),
            instanceType: InstanceType.of(
                InstanceClass.BURSTABLE2,
                InstanceSize.SMALL
            ),
            vpc: props.vpc,
            maxAllocatedStorage: 200,
            credentials: {
                username: hasuraUsername,
                password: databasePassword,
            },
        });

        // adds DB connections information in the secret
        const hasuraUserSecret = new DatabaseSecret(
            this,
            "HasuraDatabaseUser",
            {
                username: hasuraUsername,
                masterSecret: this.postgres.secret,
            }
        );
        hasuraUserSecret.attach(this.postgres);

        // postgres connection string
        const connectionString = `postgres://${hasuraUsername}:${databasePassword.toString()}@${
            this.postgres.dbInstanceEndpointAddress
        }:${this.postgres.dbInstanceEndpointPort}/${hasuraDatabaseName}`;

        // save connection string as a secret
        this.connectionSecret = new CfnSecret(this, "ConnectionSecret", {
            secretString: connectionString,
            description: "Hasura RDS connection string",
        });

        // ALB / Fargate / Hasura container setup
        this.service = new ApplicationLoadBalancedFargateService(
            this,
            "Hasura",
            {
                publicLoadBalancer: true, // Default is false
                assignPublicIp: true,
                cluster: new Cluster(this, "Cluster", {
                    vpc: props.vpc,
                }),
                circuitBreaker: {
                    rollback: true,
                },
                taskImageOptions: {
                    image: ContainerImage.fromRegistry(
                        `${
                            props.hasuraOptions?.imageName ||
                            "hasura/graphql-engine"
                        }:${props.hasuraOptions?.version || "latest"}`
                    ),
                    containerPort: 8080,
                    enableLogging: true,
                    environment: {
                        HASURA_GRAPHQL_ENABLE_CONSOLE: "true",
                        HASURA_GRAPHQL_PG_CONNECTIONS: "100",
                        HASURA_GRAPHQL_LOG_LEVEL: "debug",
                    },
                    secrets: this.getSecrets(),
                },
            }
        );

        // configure health check endpoint for hasura
        this.service.targetGroup.configureHealthCheck({
            path: "/healthz",
        });

        // allow postgres connection from ECS service
        this.postgres.connections.allowFrom(
            this.service.service,
            Port.tcp(this.postgres.instanceEndpoint.port)
        );
    }

    private getSecrets(): { [x: string]: ECSSecret } {
        let ecsSecrets: { [x: string]: ECSSecret } = {
            HASURA_GRAPHQL_DATABASE_URL: ECSSecret.fromSecretsManager(
                Secret.fromSecretCompleteArn(
                    this,
                    "EcsConnectionSecret",
                    this.connectionSecret.ref
                )
            ),
        };

        if (this.props.hasuraOptions?.adminSecret) {
            ecsSecrets.HASURA_GRAPHQL_ADMIN_SECRET =
                ECSSecret.fromSecretsManager(
                    this.props.hasuraOptions.adminSecret
                );
        } else {
            ecsSecrets.HASURA_GRAPHQL_ADMIN_SECRET =
                ECSSecret.fromSecretsManager(
                    new Secret(this, "AdminSecret", {
                        generateSecretString: {
                            excludePunctuation: true,
                        },
                    })
                );
        }

        if (this.props.hasuraOptions?.jwtSecret) {
            ecsSecrets.HASURA_GRAPHQL_JWT_SECRET = ECSSecret.fromSecretsManager(
                this.props.hasuraOptions.jwtSecret
            );
        }

        return ecsSecrets;
    }
}

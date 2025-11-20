export interface AppConfig {
    env: {
        name: string
    },
    appInsights: {
        instrumentationKey: string
    },
    logging: {
        console: boolean,
        appInsights: boolean,
    },
    aad: {
        requireAuth: boolean,
        tenant: string,
        clientId: string,

    },
    apiServer: {
        url: string,
        metadata: string,
        rules: string,
    },
}

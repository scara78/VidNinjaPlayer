// Provider configuration service
export interface ProviderConfig {
    id: string;
    displayName: string;
    enabled: boolean;
    rank: number;
}

export class ProviderConfigService {
    private static instance: ProviderConfigService;
    private providers: ProviderConfig[] = [];

    private constructor() {
        this.initializeProviders();
    }

    public static getInstance(): ProviderConfigService {
        if (!ProviderConfigService.instance) {
            ProviderConfigService.instance = new ProviderConfigService();
        }
        return ProviderConfigService.instance;
    }

    private initializeProviders() {
        // Define all available providers with their configuration
        const providerDefinitions = [
            {
                id: 'vidsrc.vip',
                envKey: 'VIDSRC_VIP',
                defaultName: 'Ultra Server',
                rank: 1
            },
            {
                id: 'flixhq',
                envKey: 'FLIXHQ',
                defaultName: 'Premium Server',
                rank: 2
            },
            {
                id: 'zoechip',
                envKey: 'ZOECHIP',
                defaultName: 'Turbo Server',
                rank: 3
            },
            {
                id: 'viewasian',
                envKey: 'VIEWASIAN',
                defaultName: 'Speed Server',
                rank: 4
            },
            {
                id: 'superstream',
                envKey: 'SUPERSTREAM',
                defaultName: 'Max Server',
                rank: 5
            }
        ];

        this.providers = providerDefinitions.map(provider => {
            const enabled = this.getEnvBoolean(`NEXT_PUBLIC_PROVIDER_${provider.envKey}_ENABLED`, false);
            const displayName = this.getEnvString(`NEXT_PUBLIC_SERVER_NAME_${provider.envKey}`, provider.defaultName);

            return {
                id: provider.id,
                displayName,
                enabled,
                rank: provider.rank
            };
        });

        console.log('Initialized providers:', this.providers);
    }

    private getEnvBoolean(key: string, defaultValue: boolean): boolean {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === 'true';
    }

    private getEnvString(key: string, defaultValue: string): string {
        return process.env[key] || defaultValue;
    }

    /**
     * Get all enabled providers
     */
    public getEnabledProviders(): ProviderConfig[] {
        return this.providers.filter(provider => provider.enabled);
    }

    /**
     * Get all providers (enabled and disabled)
     */
    public getAllProviders(): ProviderConfig[] {
        return [...this.providers];
    }

    /**
     * Get provider by ID
     */
    public getProvider(id: string): ProviderConfig | undefined {
        return this.providers.find(provider => provider.id === id);
    }

    /**
     * Get display name for a provider
     */
    public getProviderDisplayName(id: string): string {
        const provider = this.getProvider(id);
        return provider?.displayName || id;
    }

    /**
     * Check if a provider is enabled
     */
    public isProviderEnabled(id: string): boolean {
        const provider = this.getProvider(id);
        return provider?.enabled || false;
    }

    /**
     * Get the default provider
     */
    public getDefaultProvider(): string {
        const defaultId = process.env.NEXT_PUBLIC_DEFAULT_PROVIDER || 'vidsrc.vip';

        // Check if default provider is enabled, otherwise get first enabled provider
        if (this.isProviderEnabled(defaultId)) {
            return defaultId;
        }

        const enabledProviders = this.getEnabledProviders();
        return enabledProviders.length > 0 ? enabledProviders[0].id : defaultId;
    }

    /**
     * Get the real provider ID from display name
     */
    public getProviderIdFromDisplayName(displayName: string): string {
        const provider = this.providers.find(p => p.displayName === displayName);
        return provider?.id || displayName;
    }

    /**
     * Get providers in format expected by the scraper service
     */
    public getScraperProviders(): Array<{ id: string; name: string; rank: number }> {
        return this.getEnabledProviders().map(provider => ({
            id: provider.id,
            name: provider.displayName,
            rank: provider.rank
        }));
    }
}

// Export singleton instance
export const providerConfig = ProviderConfigService.getInstance();

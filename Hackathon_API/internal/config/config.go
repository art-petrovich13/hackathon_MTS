package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	DBHost     string `mapstructure:"DB_HOST"`
	DBPort     string `mapstructure:"DB_PORT"`
	DBUser     string `mapstructure:"DB_USER"`
	DBPassword string `mapstructure:"DB_PASSWORD"`
	DBName     string `mapstructure:"DB_NAME"`
	APIPort    string `mapstructure:"API_PORT"`
	OpenRouterKey string `mapstructure:"OPENROUTER_API_KEY"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("DB_HOST", "localhost")
	viper.SetDefault("DB_PORT", "5432")
	viper.SetDefault("DB_USER", "postgres")
	viper.SetDefault("DB_PASSWORD", "mysecretpassword")
	viper.SetDefault("DB_NAME", "iaas")
	viper.SetDefault("API_PORT", "8080")
	viper.SetDefault("OPENROUTER_API_KEY", "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")

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
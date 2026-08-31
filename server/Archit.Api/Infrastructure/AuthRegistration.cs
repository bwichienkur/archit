using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

namespace Archit.Api.Infrastructure;

public static class AuthRegistration
{
    public static bool AddConfiguredAuthentication(this IServiceCollection services,IConfiguration configuration)
    {
        var authority=configuration["Auth:Authority"]??Environment.GetEnvironmentVariable("ARCHIT_AUTH_AUTHORITY");
        var audience=configuration["Auth:Audience"]??Environment.GetEnvironmentVariable("ARCHIT_AUTH_AUDIENCE");
        var enabled=!string.IsNullOrWhiteSpace(authority)&&!string.IsNullOrWhiteSpace(audience);

        var authentication=services.AddAuthentication(options=>
        {
            if(enabled){options.DefaultAuthenticateScheme=JwtBearerDefaults.AuthenticationScheme;options.DefaultChallengeScheme=JwtBearerDefaults.AuthenticationScheme;}
        });

        if(enabled)
        {
            authentication.AddJwtBearer(options=>
            {
                options.Authority=authority;
                options.Audience=audience;
                options.RequireHttpsMetadata=!string.Equals(configuration["Auth:AllowHttpMetadata"],"true",StringComparison.OrdinalIgnoreCase);
                options.TokenValidationParameters=new TokenValidationParameters
                {
                    ValidateIssuer=true,
                    ValidateAudience=true,
                    ValidateLifetime=true,
                    NameClaimType=configuration["Auth:NameClaimType"]??"name",
                    RoleClaimType=configuration["Auth:RoleClaimType"]??"role",
                    ClockSkew=TimeSpan.FromMinutes(1),
                };
                options.Events=new JwtBearerEvents
                {
                    OnMessageReceived=context=>
                    {
                        if(context.Request.Path.StartsWithSegments("/hubs/projects")&&context.Request.Query.TryGetValue("access_token",out var token))context.Token=token;
                        return Task.CompletedTask;
                    }
                };
            });
        }

        services.AddAuthorization(options=>
        {
            if(enabled)options.FallbackPolicy=new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
        });
        services.AddSingleton(new ArchitAuthState(enabled));
        return enabled;
    }
}

public sealed record ArchitAuthState(bool Enabled);

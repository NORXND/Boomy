using BoomyBuilder.Builder;

var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

app.MapGet("/", () =>
{
    return "OK!";
});

app.MapPost("/build/v1", async (HttpContext context) =>
{
    string body = "";
    using (StreamReader stream = new StreamReader(context.Request.Body))
    {
        body = await stream.ReadToEndAsync();
    }

    BuildOperator buildOperator = new(body);
    buildOperator.Build();

    return "OK!";
});

app.Run();
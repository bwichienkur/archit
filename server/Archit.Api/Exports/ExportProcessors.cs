using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Archit.Api.Projects;

namespace Archit.Api.Exports;

public sealed record ExportArtifact(string FileName,string ContentType,ReadOnlyMemory<byte> Content);

public interface IExportProcessor
{
    string Format { get; }
    Task<ExportArtifact> ProcessAsync(ExportJobRecord job,ProjectRevision revision,CancellationToken cancellationToken);
}

public sealed class JsonExportProcessor : IExportProcessor
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    public string Format => "json";

    public Task<ExportArtifact> ProcessAsync(ExportJobRecord job,ProjectRevision revision,CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var envelope=new
        {
            schemaVersion=1,
            projectId=job.ProjectId,
            revisionId=revision.Id,
            revisionKind=revision.Kind,
            sourceImportId=revision.SourceImportId,
            generatedAt=DateTimeOffset.UtcNow,
            model=revision.Model
        };
        var bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope,JsonOptions));
        return Task.FromResult(new ExportArtifact(FileName(job,revision,"json"),"application/json",bytes));
    }

    internal static string FileName(ExportJobRecord job,ProjectRevision revision,string extension)=>$"archit-{job.ProjectId:N}-{revision.Id:N}.{extension}";
}

public sealed class CsvExportProcessor : IExportProcessor
{
    public string Format=>"csv";

    public Task<ExportArtifact> ProcessAsync(ExportJobRecord job,ProjectRevision revision,CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var model=BuildingModelJson.Parse(revision.Model);
        var wallById=model.Walls.ToDictionary(wall=>wall.Id,StringComparer.Ordinal);
        var levelById=model.Levels.ToDictionary(level=>level.Id,StringComparer.Ordinal);
        var counters=new Dictionary<string,int>(StringComparer.Ordinal){{"door",0},{"window",0},{"cased-opening",0}};
        var prefixes=new Dictionary<string,string>(StringComparer.Ordinal){{"door","D"},{"window","W"},{"cased-opening","O"}};
        var openings=model.Openings.OrderBy(opening=>wallById.TryGetValue(opening.HostWallId,out var wall)?wall.LevelId:string.Empty,StringComparer.Ordinal)
            .ThenBy(opening=>wallById.TryGetValue(opening.HostWallId,out var wall)?wall.Name:opening.HostWallId,StringComparer.Ordinal)
            .ThenBy(opening=>opening.Offset).ThenBy(opening=>opening.Id,StringComparer.Ordinal).ToArray();
        var rows=new List<string>{string.Join(',',new[]{"Mark","Type","Level","Host Wall","Width","Height","Sill Height","Units","Subtype","Handing","Swing","Validation State","Opening ID","Source CAD Entity IDs"}.Select(CsvCell))};
        foreach(var opening in openings)
        {
            if(!wallById.TryGetValue(opening.HostWallId,out var wall))throw new InvalidOperationException($"Opening {opening.Id} references missing host wall {opening.HostWallId}.");
            if(!levelById.TryGetValue(wall.LevelId,out var level))throw new InvalidOperationException($"Host wall {wall.Id} references missing level {wall.LevelId}.");
            if(!counters.ContainsKey(opening.Kind)||!prefixes.ContainsKey(opening.Kind))throw new InvalidOperationException($"Unsupported opening kind '{opening.Kind}'.");
            counters[opening.Kind]++;
            var mark=$"{prefixes[opening.Kind]}{counters[opening.Kind]:00}";
            rows.Add(string.Join(',',new[]{
                mark,opening.Kind,level.Name,wall.Name,Number(opening.Width),Number(opening.Height),opening.Kind=="window"?Number(opening.SillHeight??0):string.Empty,model.GeometryUnits,
                opening.Subtype??string.Empty,opening.Handing??string.Empty,opening.Swing??string.Empty,opening.ValidationState,opening.Id,string.Join(';',opening.SourceCadEntityIds)
            }.Select(CsvCell)));
        }
        var bytes=Encoding.UTF8.GetBytes(string.Join("\r\n",rows));
        return Task.FromResult(new ExportArtifact(JsonExportProcessor.FileName(job,revision,"csv"),"text/csv; charset=utf-8",bytes));
    }

    private static string Number(double value)=>value.ToString("0.######",CultureInfo.InvariantCulture);
    private static string CsvCell(string value)=>value.IndexOfAny(['"',',','\r','\n'])>=0?$"\"{value.Replace("\"","\"\"")}\"":value;
}

public sealed class SvgExportProcessor : IExportProcessor
{
    public string Format => "svg";

    public Task<ExportArtifact> ProcessAsync(ExportJobRecord job,ProjectRevision revision,CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var model=BuildingModelJson.Parse(revision.Model);
        var bounds=model.Bounds();
        const double margin=24;
        var minX=bounds.MinX-margin;
        var minY=bounds.MinY-margin;
        var width=Math.Max(bounds.MaxX-bounds.MinX+margin*2,100);
        var height=Math.Max(bounds.MaxY-bounds.MinY+margin*2,100);
        var sb=new StringBuilder(4096);
        sb.Append("<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" viewBox=\"")
          .Append(F(minX)).Append(' ').Append(F(minY)).Append(' ').Append(F(width)).Append(' ').Append(F(height)).Append("\" ")
          .Append("data-archit-project-id=\"").Append(job.ProjectId).Append("\" data-archit-revision-id=\"").Append(revision.Id).Append("\">\n")
          .Append("<metadata>").Append(XmlEscape(JsonSerializer.Serialize(new { generator="Archit",schemaVersion=model.SchemaVersion,projectId=model.ProjectId,projectName=model.ProjectName,geometryUnits=model.GeometryUnits,revisionId=revision.Id,sourceImportId=revision.SourceImportId }))).Append("</metadata>\n")
          .Append("<g id=\"rooms\" fill=\"none\" stroke=\"#aeb8bd\" stroke-width=\"0.75\" stroke-dasharray=\"4 3\">\n");
        foreach(var room in model.Rooms)
        {
            if(room.Boundary.Count<3)continue;
            sb.Append("<polygon data-archit-kind=\"room\" data-archit-id=\"").Append(XmlEscape(room.Id)).Append("\" points=\"");
            foreach(var point in room.Boundary)sb.Append(F(point.X)).Append(',').Append(F(point.Y)).Append(' ');
            sb.Append("\"/>\n");
        }
        sb.Append("</g>\n<g id=\"walls\" fill=\"none\" stroke=\"#111820\" stroke-linecap=\"square\">\n");
        foreach(var wall in model.Walls)
        {
            var lineage=wall.SourceCadEntityIds.Count==0?string.Empty:string.Join(',',wall.SourceCadEntityIds);
            sb.Append("<line data-archit-kind=\"wall\" data-archit-id=\"").Append(XmlEscape(wall.Id)).Append("\" data-source-cad-ids=\"").Append(XmlEscape(lineage))
              .Append("\" x1=\"").Append(F(wall.Start.X)).Append("\" y1=\"").Append(F(wall.Start.Y)).Append("\" x2=\"").Append(F(wall.End.X)).Append("\" y2=\"").Append(F(wall.End.Y))
              .Append("\" stroke-width=\"").Append(F(Math.Max(wall.Thickness,0.01))).Append("\"/>\n");
        }
        sb.Append("</g>\n<g id=\"openings\" fill=\"none\" stroke=\"#ffffff\">\n");
        foreach(var opening in model.Openings)
        {
            var wall=model.Walls.FirstOrDefault(item=>item.Id==opening.HostWallId);if(wall is null)continue;
            var dx=wall.End.X-wall.Start.X;var dy=wall.End.Y-wall.Start.Y;var len=Math.Sqrt(dx*dx+dy*dy);if(len<=1e-9)continue;
            var ux=dx/len;var uy=dy/len;var start=opening.Offset;var end=start+opening.Width;
            sb.Append("<line data-archit-kind=\"").Append(XmlEscape(opening.Kind)).Append("\" data-archit-id=\"").Append(XmlEscape(opening.Id))
              .Append("\" x1=\"").Append(F(wall.Start.X+ux*start)).Append("\" y1=\"").Append(F(wall.Start.Y+uy*start)).Append("\" x2=\"").Append(F(wall.Start.X+ux*end)).Append("\" y2=\"").Append(F(wall.Start.Y+uy*end))
              .Append("\" stroke-width=\"").Append(F(Math.Max(wall.Thickness*1.15,1))).Append("\"/>\n");
        }
        sb.Append("</g>\n</svg>\n");
        return Task.FromResult(new ExportArtifact(JsonExportProcessor.FileName(job,revision,"svg"),"image/svg+xml",Encoding.UTF8.GetBytes(sb.ToString())));
    }

    private static string F(double value)=>value.ToString("0.######",CultureInfo.InvariantCulture);
    private static string XmlEscape(string value)=>System.Security.SecurityElement.Escape(value)??string.Empty;
}

public sealed class GltfExportProcessor : IExportProcessor
{
    private static readonly JsonSerializerOptions JsonOptions=new(JsonSerializerDefaults.Web){WriteIndented=true,Encoder=JavaScriptEncoder.UnsafeRelaxedJsonEscaping};
    public string Format=>"gltf";

    public Task<ExportArtifact> ProcessAsync(ExportJobRecord job,ProjectRevision revision,CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var model=BuildingModelJson.Parse(revision.Model);
        var toMeters=BuildingModelJson.MetersPerUnit(model.GeometryUnits);
        var nodes=new List<object>();
        foreach(var wall in model.Walls)
        {
            var dx=wall.End.X-wall.Start.X;var dz=wall.End.Y-wall.Start.Y;var length=Math.Sqrt(dx*dx+dz*dz);if(length<=1e-9)continue;
            var angle=-Math.Atan2(dz,dx);var extras=new Dictionary<string,object?>{{"architKind","wall"},{"architId",wall.Id},{"sourceCadEntityIds",wall.SourceCadEntityIds}};
            nodes.Add(new { name=string.IsNullOrWhiteSpace(wall.Name)?wall.Id:wall.Name,mesh=0,translation=new[]{(wall.Start.X+wall.End.X)/2*toMeters,(wall.BaseElevation+wall.Height/2)*toMeters,(wall.Start.Y+wall.End.Y)/2*toMeters},rotation=YQuaternion(angle),scale=new[]{length*toMeters,wall.Height*toMeters,wall.Thickness*toMeters},extras });
        }
        foreach(var cabinet in model.Cabinets)nodes.Add(new { name=cabinet.Id,mesh=0,translation=new[]{cabinet.Origin.X*toMeters,cabinet.Height*toMeters/2,cabinet.Origin.Y*toMeters},rotation=YQuaternion(-cabinet.Rotation),scale=new[]{cabinet.Width*toMeters,cabinet.Height*toMeters,cabinet.Depth*toMeters},extras=new { architKind="cabinet",architId=cabinet.Id } });
        foreach(var fixture in model.Fixtures)
        {
            var w=fixture.Width??.5;var d=fixture.Depth??.5;var h=fixture.Height??.5;
            nodes.Add(new { name=fixture.Id,mesh=0,translation=new[]{fixture.Origin.X*toMeters,h*toMeters/2,fixture.Origin.Y*toMeters},rotation=YQuaternion(-fixture.Rotation),scale=new[]{w*toMeters,h*toMeters,d*toMeters},extras=new { architKind=fixture.Category,architId=fixture.Id } });
        }
        var cube=UnitCube();
        var gltf=new
        {
            asset=new { version="2.0",generator="Archit Server" },scene=0,
            scenes=new[]{new { name=model.ProjectName,nodes=Enumerable.Range(0,nodes.Count).ToArray() }},nodes,
            meshes=new[]{new { name="Archit Unit Cube",primitives=new[]{new { attributes=new { POSITION=0,NORMAL=1 },indices=2 }} }},
            buffers=new[]{new { byteLength=cube.Bytes.Length,uri="data:application/octet-stream;base64,"+Convert.ToBase64String(cube.Bytes) }},
            bufferViews=cube.Views,accessors=cube.Accessors,
            extras=new { projectId=model.ProjectId,revisionId=revision.Id,geometryUnits=model.GeometryUnits,source="BuildingModelV2",sourceImportId=revision.SourceImportId }
        };
        var bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(gltf,JsonOptions));
        return Task.FromResult(new ExportArtifact(JsonExportProcessor.FileName(job,revision,"gltf"),"model/gltf+json",bytes));
    }

    private static double[] YQuaternion(double angle)=>[0,Math.Sin(angle/2),0,Math.Cos(angle/2)];
    private static (byte[] Bytes,object[] Views,object[] Accessors) UnitCube()
    {
        float[] positions=[-.5f,-.5f,-.5f,.5f,-.5f,-.5f,.5f,.5f,-.5f,-.5f,.5f,-.5f,-.5f,-.5f,.5f,.5f,-.5f,.5f,.5f,.5f,.5f,-.5f,.5f,.5f];
        var inv=(float)(1/Math.Sqrt(3));float[] normals=[-inv,-inv,-inv,inv,-inv,-inv,inv,inv,-inv,-inv,inv,-inv,-inv,-inv,inv,inv,-inv,inv,inv,inv,inv,-inv,inv,inv];
        ushort[] indices=[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,1,5,6,1,6,2,0,3,7,0,7,4];
        var p=new byte[positions.Length*sizeof(float)];var n=new byte[normals.Length*sizeof(float)];var i=new byte[indices.Length*sizeof(ushort)];Buffer.BlockCopy(positions,0,p,0,p.Length);Buffer.BlockCopy(normals,0,n,0,n.Length);Buffer.BlockCopy(indices,0,i,0,i.Length);
        var bytes=new byte[p.Length+n.Length+i.Length];Buffer.BlockCopy(p,0,bytes,0,p.Length);Buffer.BlockCopy(n,0,bytes,p.Length,n.Length);Buffer.BlockCopy(i,0,bytes,p.Length+n.Length,i.Length);
        object[] views=[new { buffer=0,byteOffset=0,byteLength=p.Length,target=34962 },new { buffer=0,byteOffset=p.Length,byteLength=n.Length,target=34962 },new { buffer=0,byteOffset=p.Length+n.Length,byteLength=i.Length,target=34963 }];
        object[] accessors=[new { bufferView=0,componentType=5126,count=8,type="VEC3",min=new[]{-.5,-.5,-.5},max=new[]{.5,.5,.5} },new { bufferView=1,componentType=5126,count=8,type="VEC3" },new { bufferView=2,componentType=5123,count=indices.Length,type="SCALAR" }];
        return(bytes,views,accessors);
    }
}

public sealed class ExportProcessorRegistry
{
    private readonly IReadOnlyDictionary<string,IExportProcessor> _processors;

    public ExportProcessorRegistry()
    {
        IExportProcessor[] builtIns=[new JsonExportProcessor(),new CsvExportProcessor(),new SvgExportProcessor(),new GltfExportProcessor()];
        _processors=builtIns.ToDictionary(processor=>processor.Format,StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyCollection<string> Formats => _processors.Keys.ToArray();
    public bool Supports(string format)=>!string.IsNullOrWhiteSpace(format)&&_processors.ContainsKey(format);
    public IExportProcessor GetRequired(string format)=>_processors.TryGetValue(format,out var processor)
        ? processor
        : throw new InvalidOperationException($"Export format {format} does not have a configured server-side processor.");
}

internal sealed record Point2(double X,double Y);
internal sealed record ExportLevel(string Id,string Name);
internal sealed record ExportWall(string Id,string LevelId,string Name,Point2 Start,Point2 End,double Thickness,double Height,double BaseElevation,IReadOnlyList<string> SourceCadEntityIds);
internal sealed record ExportOpening(string Id,string Kind,string HostWallId,double Offset,double Width,double Height,double? SillHeight,string? Subtype,string? Handing,string? Swing,string ValidationState,IReadOnlyList<string> SourceCadEntityIds);
internal sealed record ExportRoom(string Id,IReadOnlyList<Point2> Boundary);
internal sealed record ExportCabinet(string Id,Point2 Origin,double Rotation,double Width,double Depth,double Height);
internal sealed record ExportFixture(string Id,string Category,Point2 Origin,double Rotation,double? Width,double? Depth,double? Height);
internal sealed record ExportBuildingModel(int SchemaVersion,string ProjectId,string ProjectName,string GeometryUnits,IReadOnlyList<ExportLevel> Levels,IReadOnlyList<ExportWall> Walls,IReadOnlyList<ExportOpening> Openings,IReadOnlyList<ExportRoom> Rooms,IReadOnlyList<ExportCabinet> Cabinets,IReadOnlyList<ExportFixture> Fixtures)
{
    public (double MinX,double MinY,double MaxX,double MaxY) Bounds()
    {
        var points=Walls.SelectMany(w=>new[]{w.Start,w.End}).Concat(Rooms.SelectMany(r=>r.Boundary)).ToArray();
        if(points.Length==0)return(0,0,100,100);
        return(points.Min(p=>p.X),points.Min(p=>p.Y),points.Max(p=>p.X),points.Max(p=>p.Y));
    }
}

internal static class BuildingModelJson
{
    public static ExportBuildingModel Parse(JsonElement root)
    {
        if(root.ValueKind!=JsonValueKind.Object||Int(root,"schemaVersion")!=2)throw new InvalidOperationException("CSV/SVG/glTF export requires a BuildingModelV2 revision snapshot.");
        var units=String(root,"geometryUnits");if(string.IsNullOrWhiteSpace(units)||units=="unitless")throw new InvalidOperationException("CSV/SVG/glTF export requires calibrated BuildingModelV2 geometry units.");
        return new ExportBuildingModel(2,String(root,"projectId"),String(root,"projectName"),units,
            JsonArray(root,"levels").Select(Level).ToArray(),JsonArray(root,"walls").Select(Wall).ToArray(),JsonArray(root,"openings").Select(Opening).ToArray(),JsonArray(root,"rooms").Select(Room).ToArray(),JsonArray(root,"cabinets").Select(Cabinet).ToArray(),JsonArray(root,"fixtures").Select(Fixture).ToArray());
    }
    public static double MetersPerUnit(string unit)=>unit switch{"inches"=>.0254,"feet"=>.3048,"millimeters"=>.001,"centimeters"=>.01,"meters"=>1,_=>throw new InvalidOperationException($"Unsupported geometry unit '{unit}'.")};
    private static ExportLevel Level(JsonElement e)=>new(String(e,"id"),String(e,"name"));
    private static ExportWall Wall(JsonElement e)=>new(String(e,"id"),String(e,"levelId"),String(e,"name"),Point(e,"start"),Point(e,"end"),Double(e,"thickness"),Double(e,"height"),Double(e,"baseElevation"),LineageIds(e));
    private static ExportOpening Opening(JsonElement e)=>new(String(e,"id"),String(e,"kind"),String(e,"hostWallId"),Double(e,"offsetFromWallStart"),Double(e,"width"),Double(e,"height"),NullableDouble(e,"sillHeight"),NullableString(e,"subtype"),NullableString(e,"handing"),NullableString(e,"swing"),LineageState(e),LineageIds(e));
    private static ExportRoom Room(JsonElement e)=>new(String(e,"id"),JsonArray(e,"boundary").Select(p=>new Point2(Double(p,"x"),Double(p,"y"))).ToArray());
    private static ExportCabinet Cabinet(JsonElement e)=>new(String(e,"id"),Point(e,"origin"),Double(e,"rotation"),Double(e,"width"),Double(e,"depth"),Double(e,"height"));
    private static ExportFixture Fixture(JsonElement e)=>new(String(e,"id"),String(e,"category"),Point(e,"origin"),Double(e,"rotation"),NullableDouble(e,"width"),NullableDouble(e,"depth"),NullableDouble(e,"height"));
    private static Point2 Point(JsonElement e,string name){var p=e.GetProperty(name);return new Point2(Double(p,"x"),Double(p,"y"));}
    private static IReadOnlyList<string> LineageIds(JsonElement e){if(!e.TryGetProperty("lineage",out var lineage)||!lineage.TryGetProperty("sourceCadEntityIds",out var ids)||ids.ValueKind!=JsonValueKind.Array)return System.Array.Empty<string>();return ids.EnumerateArray().Where(x=>x.ValueKind==JsonValueKind.String).Select(x=>x.GetString()!).ToArray();}
    private static string LineageState(JsonElement e)=>e.TryGetProperty("lineage",out var lineage)?String(lineage,"validationState"):string.Empty;
    private static IEnumerable<JsonElement> JsonArray(JsonElement e,string name)=>e.TryGetProperty(name,out var value)&&value.ValueKind==JsonValueKind.Array?value.EnumerateArray():Enumerable.Empty<JsonElement>();
    private static string String(JsonElement e,string name)=>e.TryGetProperty(name,out var value)&&value.ValueKind==JsonValueKind.String?value.GetString()??string.Empty:string.Empty;
    private static string? NullableString(JsonElement e,string name)=>e.TryGetProperty(name,out var value)&&value.ValueKind==JsonValueKind.String?value.GetString():null;
    private static int Int(JsonElement e,string name)=>e.TryGetProperty(name,out var value)&&value.TryGetInt32(out var number)?number:0;
    private static double Double(JsonElement e,string name)=>e.TryGetProperty(name,out var value)&&value.TryGetDouble(out var number)?number:0;
    private static double? NullableDouble(JsonElement e,string name)=>e.TryGetProperty(name,out var value)&&value.TryGetDouble(out var number)?number:null;
}
